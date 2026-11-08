"""Phone command -> virtual Xbox 360 controller mapping. Edit here to rebind.

Command names match SimCommand raw values in the iOS app.
"""

# Short button names -> vgamepad XUSB_BUTTON attribute names.
BUTTONS = {
    "A": "XUSB_GAMEPAD_A",
    "B": "XUSB_GAMEPAD_B",
    "X": "XUSB_GAMEPAD_X",
    "Y": "XUSB_GAMEPAD_Y",
    "LB": "XUSB_GAMEPAD_LEFT_SHOULDER",
    "RB": "XUSB_GAMEPAD_RIGHT_SHOULDER",
    "LS": "XUSB_GAMEPAD_LEFT_THUMB",
    "RS": "XUSB_GAMEPAD_RIGHT_THUMB",
    "BACK": "XUSB_GAMEPAD_BACK",
    "START": "XUSB_GAMEPAD_START",  # intentionally unbound below
    "DPAD_UP": "XUSB_GAMEPAD_DPAD_UP",
    "DPAD_DOWN": "XUSB_GAMEPAD_DPAD_DOWN",
    "DPAD_LEFT": "XUSB_GAMEPAD_DPAD_LEFT",
    "DPAD_RIGHT": "XUSB_GAMEPAD_DPAD_RIGHT",
}

BINDINGS = {
    "shift_up": "RB",
    "shift_down": "LB",
    "pit_limiter": "Y",
    "drs": "X",
    "headlights": "DPAD_UP",
    "horn": "A",          # held: down/up
    "look_back": "B",     # held: down/up
    "tc_down": "DPAD_LEFT",
    "tc_up": "DPAD_RIGHT",
    "abs_down": "LS",
    "abs_up": "RS",
    "camera": "BACK",
}

# Axes: steer -> left stick X, throttle -> right trigger, brake -> left trigger.
AXES = {
    "steer": "left_stick_x",
    "throttle": "right_trigger",
    "brake": "left_trigger",
}

HELD_COMMANDS = {"horn", "look_back"}
