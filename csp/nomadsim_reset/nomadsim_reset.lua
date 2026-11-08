-- NomadSim reset app for Custom Shaders Patch (CSP) Lua apps.
--
-- DRAFT, UNTESTED: written without Assetto Corsa on the dev machine. Every API call marked TODO(verify)
-- must be checked against the CSP Lua SDK shipped with your CSP build
-- (extension/internal/lua-sdk/, mirrored in part at https://github.com/ac-custom-shaders-patch/acc-lua-sdk).
-- The public SDK mirror did not contain definitions for the car-state or UDP calls below when this was
-- written, so names and signatures are from memory of CSP's API.
--
-- Protocol (UDP, 127.0.0.1:9101), same as coach/reset.py:
--   "SAVE"        -> save the current car state; reply "SAVED <x> <y> <z> <speed_kmh>"
--   "RESET <id>"  -> load the saved state; reply "ACK <id>"
-- Offline practice only. Loading a car state invalidates the lap.

local PORT = 9101
local savedState = nil       -- opaque state blob from ac.saveCarStateAsync
local savedInfo = ''
local lastMsg = 'waiting'

-- TODO(verify): CSP ships a LuaSocket-style library ("shared socket library"); the module name and the
-- udp API (socket.udp(), :setsockname, :settimeout, :receivefrom, :sendto) are assumed to match LuaSocket.
local socket = require('shared/socket')
local udp = socket.udp()
udp:setsockname('127.0.0.1', PORT)
udp:settimeout(0)

local function reply(msg, ip, port)
  udp:sendto(msg, ip, port)
  lastMsg = msg
end

local function handleSave(ip, port)
  local car = ac.getCar(0)
  local pos, speed = car.position, car.speedKmh
  -- TODO(verify): ac.saveCarStateAsync(callback) -> callback receives the state (maybe as (err, state)).
  ac.saveCarStateAsync(function(a, b)
    savedState = b or a
    savedInfo = string.format('%.2f %.2f %.2f %.1f', pos.x, pos.y, pos.z, speed)
    reply('SAVED ' .. savedInfo, ip, port)
  end)
end

local function handleReset(id, ip, port)
  if savedState == nil then
    reply('ERR nostate', ip, port)
    return
  end
  -- TODO(verify): ac.loadCarState(state) restores position, velocity and tyre/engine state of car 0.
  ac.loadCarState(savedState)
  reply('ACK ' .. id, ip, port)
end

function script.update(dt)
  -- drain the socket without blocking the frame
  for _ = 1, 8 do
    local data, ip, port = udp:receivefrom()
    if not data then break end
    data = data:gsub('%s+$', '')
    if data == 'SAVE' then
      handleSave(ip, port)
    else
      local id = data:match('^RESET%s+(.+)$')
      if id then handleReset(id, ip, port) end
    end
  end
end

function windowMain(dt)
  ui.text('UDP 127.0.0.1:' .. PORT)
  ui.text('state saved: ' .. tostring(savedState ~= nil))
  ui.text('last: ' .. lastMsg)
end
