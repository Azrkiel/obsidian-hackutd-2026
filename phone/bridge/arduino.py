"""Arduino pedal input (stub)."""


class ArduinoPedals:
    def __init__(self, port=None):
        self.port = port
        # TODO: open `port` with pyserial (serial.Serial(port, 115200, timeout=0))
        # and parse the Arduino's line format into (throttle, brake) in 0..1.

    def read(self):
        """Latest (throttle, brake), or None when no Arduino data is available."""
        return None
