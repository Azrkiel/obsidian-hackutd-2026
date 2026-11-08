-- Pit Pal reset app for Custom Shaders Patch (CSP) Lua apps.
--
-- API checked against the CSP v0.2.11 SDK (extension/internal/lua-sdk/ac_apps/lib.lua):
--   ac.saveCarStateAsync(callback: fun(err: string, data: string))
--   ac.loadCarState(data, dataNext?, blend?, iterations?) -> boolean (false if not allowed in this mode)
--   ac.onRelease(callback) -> called when the script reloads/unloads
--   require('shared/socket') -> LuaSocket (extension/internal/lua-shared/socket.lua)
--
-- Protocol (UDP, 127.0.0.1:9101), same as coach/reset.py:
--   "SAVE"         -> save the current car state; reply "SAVED <x> <y> <z> <speed_kmh>"
--   "SAVE resume"  -> same, into a second slot: where the driver was when a drill started
--   "RESET <id>"   -> load the saved state; reply "ACK <id>" (or "ERR <reason>")
--   "RESUME <id>"  -> load the resume slot; reply "ACK <id>" (or "ERR <reason>")
--
-- Rolling checkpoints (coach/checkpoints.py; docs/ROLLING_CHECKPOINTS.md, stage C):
--   "CFG period=<s> keep=<n> anchors=<p1>,<p2>,..."  -> reply "CFGOK <period> <keep> <n_anchors>"
--        timed saves every <period> s into a ring of <n>; a save each time the car crosses an anchor
--        (track position 0..1). Off until the first CFG; stops if no CFG for 15 s (coach gone).
--   each save is reported to the coach on 127.0.0.1:9102:
--        "CK <seq> <a|t> <spline> <kmh> <lap> <anchor|-> <call_ms> <done_ms> <bytes>"
--        call_ms = time inside saveCarStateAsync (frame cost), done_ms = until the data arrived
--   "HOLD <event> <seq>"     -> copy that state out of the ring; "HELD <event> <seq>" | "ERR gone" | "ERR full"
--   "RESTORE <id> <event>"   -> load a held state; "ACK <id>" | "ERR nohold" | "ERR notallowed"
--   "DROP <event>"           -> release it; "DROPPED <event>"
-- CSP fields used: car.splinePosition, car.lapCount, sim.isPaused, sim.isReplayActive,
-- os.preciseClock (falls back to os.clock).
-- Offline practice only. Loading a car state invalidates the lap.
--
-- Crash hardening (AC died with heap corruption 0xc0000374 right after CSP reloaded this script):
--   * the socket is created in pcall and CLOSED in ac.onRelease, so a reload never leaves a stale socket
--     bound to 9101 and nothing is left for the GC to free during AC teardown;
--   * the save callback is (err, data): an error string is never stored and later fed to loadCarState;
--   * every stage writes to the CSP log via ac.log (search custom_shaders_patch.log for "Pit Pal").

local PORT = 9101
local COACH_PORT = 9102
local MAX_HOLDS = 8          -- the coach keeps 5; a little slack so a late DROP never blocks a HOLD
local CFG_STALE_S = 15
local clock = os.preciseClock or os.clock

local cfg = { period = 0, keep = 20, anchors = {} }  -- period 0 = timed saves off
local cfgAge = math.huge
local ring = {}              -- oldest first: { seq = n, blob = s }
local anchorStates = {}      -- anchor index -> { seq = n, blob = s }
local holds, holdCount = {}, 0
local seq = 0
local saving = false
local savingFor = 0         -- watchdog: a callback that never comes must not stop saves for good
local sinceSave = 0
local lastSpline = nil
local pendingAnchor = nil
local lastCk = '-'
local saved = {}             -- slot ('checkpoint' | 'resume') -> binary blob from ac.saveCarStateAsync
local savedInfo = ''
local lastMsg = 'waiting'
local udp = nil
local sockErr = nil

local function log(msg)
  ac.log('Pit Pal: ' .. msg)
end

local function openSocket()
  local okReq, socket = pcall(require, 'shared/socket')
  if not okReq or not socket then
    return nil, 'require failed: ' .. tostring(socket)
  end
  local okUdp, s = pcall(socket.udp)
  if not okUdp or not s then
    return nil, 'udp() failed: ' .. tostring(s)
  end
  local okBind, res, err = pcall(s.setsockname, s, '127.0.0.1', PORT)
  if not okBind or not res then
    pcall(s.close, s)
    return nil, 'bind 127.0.0.1:' .. PORT .. ' failed: ' .. tostring(okBind and err or res)
  end
  s:settimeout(0)
  return s
end

udp, sockErr = openSocket()
if udp then log('listening on 127.0.0.1:' .. PORT) else log('socket disabled: ' .. tostring(sockErr)) end

ac.onRelease(function()
  if udp then
    pcall(udp.close, udp)
    udp = nil
    log('socket closed on release')
  end
end)

local function reply(msg, ip, port)
  lastMsg = msg
  if udp and ip and port then pcall(udp.sendto, udp, msg, ip, port) end
end

local function sendCoach(msg)
  if udp then pcall(udp.sendto, udp, msg, '127.0.0.1', COACH_PORT) end
end

local function forgetPosition()   -- after any load: the jump is not a lap of anchor crossings
  lastSpline, pendingAnchor, sinceSave = nil, nil, 0
end

local function isLive(car)
  local sim = ac.getSim()
  if sim and (sim.isPaused or sim.isReplayActive) then return false end
  return car.speedKmh > 10
end

-- one rolling save at a time; returns false if one is already running
local function rollingSave(kind, anchorIdx)
  if saving then return false end
  local car = ac.getCar(0)
  if not car then return false end
  saving = true
  local spline, kmh, lap = car.splinePosition, car.speedKmh, car.lapCount or 0
  local t0 = clock()
  local callMs
  local ok, err = pcall(ac.saveCarStateAsync, function(e, data)
    saving = false
    if e or type(data) ~= 'string' or #data == 0 then
      log('rolling save failed: ' .. tostring(e))
      return
    end
    seq = seq + 1
    local entry = { seq = seq, blob = data }
    if kind == 'a' then
      anchorStates[anchorIdx] = entry
    else
      ring[#ring + 1] = entry
      while #ring > cfg.keep do table.remove(ring, 1) end
    end
    lastCk = string.format('CK %d %s %.5f %.1f %d %s %.2f %.2f %d', seq, kind, spline, kmh, lap,
      anchorIdx and tostring(anchorIdx) or '-', callMs or -1, (clock() - t0) * 1000, #data)
    sendCoach(lastCk)
  end)
  callMs = (clock() - t0) * 1000
  if not ok then
    saving = false
    log('rolling save error: ' .. tostring(err))
    return false
  end
  return true
end

-- did the car move forward over track position a between p and s (lap wrap included)?
local function crossed(p, s, a)
  if s >= p then
    if s - p > 0.05 then return false end   -- a jump, not driving
    return p < a and a <= s
  end
  if p - s < 0.5 then return false end      -- going backwards
  return a > p or a <= s                    -- wrapped past the start line
end

local function rollingUpdate(dt)
  cfgAge = cfgAge + dt
  if saving then
    savingFor = savingFor + dt
    if savingFor > 5 then saving = false; log('rolling save timed out') end
  else
    savingFor = 0
  end
  if cfgAge > CFG_STALE_S then return end
  local car = ac.getCar(0)
  if not car then return end
  local live = isLive(car)
  local s = car.splinePosition
  if pendingAnchor and rollingSave('a', pendingAnchor) then pendingAnchor = nil end
  if lastSpline and live then
    for i, a in ipairs(cfg.anchors) do
      if crossed(lastSpline, s, a) and not rollingSave('a', i) then pendingAnchor = i end
    end
  end
  lastSpline = s
  sinceSave = sinceSave + dt
  if cfg.period > 0 and live and sinceSave >= cfg.period and rollingSave('t') then sinceSave = 0 end
end

local function findState(n)
  for _, e in ipairs(ring) do if e.seq == n then return e.blob end end
  for _, e in pairs(anchorStates) do if e.seq == n then return e.blob end end
  return nil
end

local function handleCfg(args, ip, port)
  local period = tonumber(args:match('period=(%S+)')) or cfg.period
  local keep = math.max(1, math.floor(tonumber(args:match('keep=(%d+)')) or cfg.keep))
  local list = {}
  for v in (args:match('anchors=(%S*)') or ''):gmatch('[^,]+') do
    local a = tonumber(v)
    if a then list[#list + 1] = a end
  end
  local changed = #list ~= #cfg.anchors
  for i, a in ipairs(list) do changed = changed or cfg.anchors[i] ~= a end
  if changed then anchorStates = {} end
  cfg.period, cfg.keep, cfg.anchors, cfgAge = period, keep, list, 0
  while #ring > cfg.keep do table.remove(ring, 1) end
  reply(string.format('CFGOK %g %d %d', period, keep, #list), ip, port)
end

local function handleHold(event, n, ip, port)
  local blob = findState(n)
  if not blob then reply('ERR gone', ip, port) return end
  if holds[event] == nil then
    if holdCount >= MAX_HOLDS then reply('ERR full', ip, port) return end
    holdCount = holdCount + 1
  end
  holds[event] = blob
  reply('HELD ' .. event .. ' ' .. n, ip, port)
end

local function handleDrop(event, ip, port)
  if holds[event] ~= nil then
    holds[event] = nil
    holdCount = holdCount - 1
  end
  reply('DROPPED ' .. event, ip, port)
end

local function loadState(state, id, ip, port)
  local ok, res = pcall(ac.loadCarState, state)
  if not ok then
    log('load error: ' .. tostring(res))
    reply('ERR load', ip, port)
  elseif res == false then
    reply('ERR notallowed', ip, port)   -- not offline single-car practice
  else
    forgetPosition()
    reply('ACK ' .. id, ip, port)
  end
end

local function handleSave(slot, ip, port)
  local car = ac.getCar(0)
  if not car then reply('ERR nocar', ip, port) return end
  local pos, speed = car.position, car.speedKmh
  ac.saveCarStateAsync(function(err, data)
    if err or type(data) ~= 'string' or #data == 0 then
      log('save failed: ' .. tostring(err))
      reply('ERR save ' .. tostring(err), ip, port)
      return
    end
    saved[slot] = data
    savedInfo = string.format('%.2f %.2f %.2f %.1f', pos.x, pos.y, pos.z, speed)
    log('saved ' .. slot .. ' ' .. savedInfo .. ' (' .. #data .. ' bytes)')
    reply('SAVED ' .. savedInfo, ip, port)
  end)
end

local function handleReset(slot, id, ip, port)
  local state = saved[slot]
  if state == nil then
    reply('ERR nostate', ip, port)
    return
  end
  loadState(state, id, ip, port)
end

function script.update(dt)
  if not udp then return end
  rollingUpdate(dt)
  -- drain the socket without blocking the frame
  for _ = 1, 8 do
    local ok, data, ip, port = pcall(udp.receivefrom, udp)
    if not ok or not data then break end
    data = data:gsub('%s+$', '')
    if data == 'SAVE' then
      handleSave('checkpoint', ip, port)
    elseif data == 'SAVE resume' then
      handleSave('resume', ip, port)
    else
      local id = data:match('^RESET%s+(.+)$')
      if id then handleReset('checkpoint', id, ip, port) end
      local rid = data:match('^RESUME%s+(.+)$')
      if rid then handleReset('resume', rid, ip, port) end
      local cargs = data:match('^CFG%s*(.*)$')
      if cargs then handleCfg(cargs, ip, port) end
      local hev, hseq = data:match('^HOLD%s+(%S+)%s+(%d+)$')
      if hev then handleHold(hev, tonumber(hseq), ip, port) end
      local xid, xev = data:match('^RESTORE%s+(%S+)%s+(%S+)$')
      if xid then
        if holds[xev] == nil then reply('ERR nohold', ip, port) else loadState(holds[xev], xid, ip, port) end
      end
      local dev = data:match('^DROP%s+(%S+)$')
      if dev then handleDrop(dev, ip, port) end
    end
  end
end

function windowMain(dt)
  if udp then ui.text('UDP 127.0.0.1:' .. PORT) else ui.text('socket OFF: ' .. tostring(sockErr)) end
  ui.text('checkpoint saved: ' .. tostring(saved.checkpoint ~= nil) .. '   resume saved: ' .. tostring(saved.resume ~= nil))
  ui.text('last: ' .. lastMsg)
  local on = cfgAge <= CFG_STALE_S
  ui.text(string.format('rolling: %s  ring %d/%d  anchors %d  holds %d', on and 'on' or 'off', #ring,
    cfg.keep, #cfg.anchors, holdCount))
  ui.text(lastCk)
end
