-- NomadSim reset app for Custom Shaders Patch (CSP) Lua apps.
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
-- Offline practice only. Loading a car state invalidates the lap.
--
-- Crash hardening (AC died with heap corruption 0xc0000374 right after CSP reloaded this script):
--   * the socket is created in pcall and CLOSED in ac.onRelease, so a reload never leaves a stale socket
--     bound to 9101 and nothing is left for the GC to free during AC teardown;
--   * the save callback is (err, data): an error string is never stored and later fed to loadCarState;
--   * every stage writes to the CSP log via ac.log (search custom_shaders_patch.log for "NomadSim").

local PORT = 9101
local saved = {}             -- slot ('checkpoint' | 'resume') -> binary blob from ac.saveCarStateAsync
local savedInfo = ''
local lastMsg = 'waiting'
local udp = nil
local sockErr = nil

local function log(msg)
  ac.log('NomadSim: ' .. msg)
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
  local ok, res = pcall(ac.loadCarState, state)
  if not ok then
    log('load error: ' .. tostring(res))
    reply('ERR load', ip, port)
  elseif res == false then
    reply('ERR notallowed', ip, port)   -- not offline single-car practice
  else
    reply('ACK ' .. id, ip, port)
  end
end

function script.update(dt)
  if not udp then return end
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
    end
  end
end

function windowMain(dt)
  if udp then ui.text('UDP 127.0.0.1:' .. PORT) else ui.text('socket OFF: ' .. tostring(sockErr)) end
  ui.text('checkpoint saved: ' .. tostring(saved.checkpoint ~= nil) .. '   resume saved: ' .. tostring(saved.resume ~= nil))
  ui.text('last: ' .. lastMsg)
end
