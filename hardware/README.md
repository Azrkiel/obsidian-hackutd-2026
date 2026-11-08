# Pedals



Board: Arduino UNO R4 WiFi. Sensors: HC-SR04 x2.

Pins: gas Trig D4 / Echo D5, brake Trig D2 / Echo D3, both on 5V and GND.

Calibration (cm): REST gas 9.2 brake 8.5, PRESS gas 3.4 brake 3.8

(set MEASURE 1 in the sketch to re-measure).



Demo: run the team bridge (bridge\bridge.py on the pc-bridge branch), NOT hardware\bridge.py. Two bridges make two virtual pads in the game. hardware\bridge.py is only a standalone pedal tester.

Needs Python 3, the ViGEmBus driver, and `pip install -r requirements.txt`.

