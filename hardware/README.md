# Pedals

Arduino UNO R4 WiFi with two HC-SR04 ultrasonic sensors: one measures how far the gas pedal is down, one the brake.

| Pedal | Trig | Echo | Calibration in the sketch (cm): rest / pressed |
| --- | --- | --- | --- |
| Gas | D4 | D5 | 9.2 / 4.0 |
| Brake | D2 | D3 | 8.5 / 3.8 |

Both sensors use 5V and GND. To re-measure, set `MEASURE 1` in [`pedals/pedals.ino`](pedals/pedals.ino), read the distances, update
`REST` and `PRESS`, and upload with `MEASURE 0`.

The full build (parts, wiring, mounting, flashing, calibration) is in the [setup guide](../SETUP.md#part-a-build-the-pedals).

Demo: the coach reads the pedals itself (`PitPal.bat`, or `python -m coach ... --inputs`). `bridge.py` here is only a standalone pedal
tester: do **not** run it next to the coach, because two receivers make two virtual pads in the game.
It needs Python 3, the ViGEmBus driver and `pip install -r requirements.txt`.
