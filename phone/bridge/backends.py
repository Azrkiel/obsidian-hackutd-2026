"""Output backends plus the Driver that turns packets into backend calls."""

import heapq
import time
from typing import Protocol

from bindings import BINDINGS, BUTTONS
from protocol import Watchdog, merge_pedals

TAP_SECONDS = 0.06


class Backend(Protocol):
    def set_axes(self, steer: float, throttle: float, brake: float) -> None: ...
    def press(self, button: str) -> None: ...
    def release(self, button: str) -> None: ...
    def update(self) -> None: ...


class DryRunBackend:
    """Logs instead of driving a controller. Axis logs are throttled to ~10 Hz."""

    def __init__(self, log=print, clock=time.monotonic, interval=0.1):
        self._log = log
        self._clock = clock
        self._interval = interval
        self._axes = (0.0, 0.0, 0.0)
        self._logged_axes = self._axes
        self._last_log = None

    def set_axes(self, steer, throttle, brake):
        self._axes = (steer, throttle, brake)

    def press(self, button):
        self._log(f"press   {button}")

    def release(self, button):
        self._log(f"release {button}")

    def update(self):
        if self._axes == self._logged_axes:
            return
        now = self._clock()
        neutral = self._axes == (0.0, 0.0, 0.0)
        if neutral or self._last_log is None or now - self._last_log >= self._interval:
            steer, throttle, brake = self._axes
            self._log(f"axes    steer={steer:+.2f} throttle={throttle:.2f} brake={brake:.2f}")
            self._logged_axes = self._axes
            self._last_log = now


class GamepadBackend:
    """Virtual Xbox 360 controller via vgamepad (Windows + ViGEmBus)."""

    def __init__(self):
        try:
            import vgamepad  # imported lazily: Windows only
        except ImportError as error:
            raise RuntimeError(
                "vgamepad is not installed. On Windows, install ViGEmBus, then run "
                "`py -m pip install -r bridge\\requirements.txt`."
            ) from error
        self._buttons = {name: getattr(vgamepad.XUSB_BUTTON, attr) for name, attr in BUTTONS.items()}
        self._pad = vgamepad.VX360Gamepad()

    def set_axes(self, steer, throttle, brake):
        self._pad.left_joystick_float(x_value_float=steer, y_value_float=0.0)
        self._pad.right_trigger_float(value_float=throttle)
        self._pad.left_trigger_float(value_float=brake)

    def press(self, button):
        self._pad.press_button(button=self._buttons[button])

    def release(self, button):
        self._pad.release_button(button=self._buttons[button])

    def update(self):
        self._pad.update()


class Driver:
    """Applies packets to a backend; taps and the watchdog run off tick()."""

    def __init__(self, backend, clock=time.monotonic, invert_steer=False, watchdog_timeout=0.25):
        self.backend = backend
        self._clock = clock
        self._invert = invert_steer
        self.watchdog = Watchdog(watchdog_timeout, clock)
        self._releases = []      # heap of (due, button)
        self._release_due = {}   # button -> latest due time
        self._held = set()
        self._neutral = True

    def handle_control(self, packet, arduino=None):
        steer = -packet.steer if self._invert else packet.steer
        throttle, brake = merge_pedals((packet.throttle, packet.brake), arduino)
        self.backend.set_axes(steer, throttle, brake)
        self.watchdog.feed()
        self._neutral = False
        self.backend.update()

    def handle_event(self, event):
        """Returns the bound button, or None if the command is unbound."""
        button = BINDINGS.get(event.command)
        if button is None or button not in BUTTONS:
            return None
        if event.phase == "tap":
            self.backend.press(button)
            due = self._clock() + TAP_SECONDS
            self._release_due[button] = due
            heapq.heappush(self._releases, (due, button))
        elif event.phase == "down":
            self._held.add(button)
            self.backend.press(button)
        else:  # up
            self._held.discard(button)
            self.backend.release(button)
        self.backend.update()
        return button

    def tick(self):
        """Call often (e.g. every 10 ms). Never blocks."""
        now = self._clock()
        changed = False
        while self._releases and self._releases[0][0] <= now:
            due, button = heapq.heappop(self._releases)
            if self._release_due.get(button) == due:  # ignore superseded taps
                del self._release_due[button]
                if button not in self._held:
                    self.backend.release(button)
                    changed = True
        if not self._neutral and self.watchdog.expired():
            self.neutralize()
            return
        if changed:
            self.backend.update()

    def neutralize(self):
        """Centre the stick, lift both pedals and release every button."""
        self.backend.set_axes(0.0, 0.0, 0.0)
        for button in sorted(self._held | set(self._release_due)):
            self.backend.release(button)
        self._held.clear()
        self._release_due.clear()
        self._releases.clear()
        self._neutral = True
        self.backend.update()
