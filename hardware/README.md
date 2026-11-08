# Pedals



Board: Arduino UNO R4 WiFi. Sensors: HC-SR04 x2.

Pins: gas Trig D4 / Echo D5, brake Trig D2 / Echo D3, both on 5V and GND.

Calibration (cm): REST gas 9.2 brake 8.5, PRESS gas 3.4 brake 3.8

(set MEASURE 1 in the sketch to re-measure).



Demo: plug in the Arduino, run `python bridge.py`, start the game.

Needs Python 3, the ViGEmBus driver, and `pip install -r requirements.txt`.

