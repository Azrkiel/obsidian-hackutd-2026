# Pedals

Arduino UNO R4 WiFi with two HC-SR04 ultrasonic sensors: one measures how far the gas pedal is down, one the brake.

| Pedal | Trig | Echo | Calibration in the sketch (cm): rest / pressed |
| --- | --- | --- | --- |
| Gas | D4 | D5 | 9.2 / 4.0 |
| Brake | D2 | D3 | 8.5 / 3.8 |

Both sensors take 5V and GND from a breadboard's + and - rails (Arduino 5V and GND feed the rails); the four signal wires go straight from
the Arduino to the sensors: 10 jumper wires in all. Wiring table, diagram and photos: [SETUP.md, A3](../SETUP.md#a3-wiring) and
[docs/HARDWARE.md](../docs/HARDWARE.md). Calibration lives in the sketch (`REST`/`PRESS`, the latest values are in the table above). To re-measure, set `MEASURE 1` in [`pedals/pedals.ino`](pedals/pedals.ino), read the distances, update
`REST` and `PRESS`, and upload with `MEASURE 0`.

The full build (parts, wiring, mounting, flashing, calibration) is in the [setup guide](../SETUP.md#part-a-build-the-pedals).

Demo: the coach reads the pedals itself (`PitPal.bat`, or `python -m coach ... --inputs`). The standalone receiver is
[`bridge/bridge.py`](../bridge/bridge.py): do **not** run it next to the coach, because two receivers make two virtual pads in the game.
