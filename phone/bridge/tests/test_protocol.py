import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from backends import TAP_SECONDS, DryRunBackend, Driver  # noqa: E402
from protocol import (  # noqa: E402
    ControlPacket, EventDeduper, EventPacket, Watchdog, merge_pedals, parse_packet,
)


class FakeClock:
    def __init__(self):
        self.now = 100.0

    def __call__(self):
        return self.now

    def advance(self, seconds):
        self.now += seconds


class RecordingBackend:
    def __init__(self):
        self.calls = []

    def set_axes(self, steer, throttle, brake):
        self.calls.append(("axes", steer, throttle, brake))

    def press(self, button):
        self.calls.append(("press", button))

    def release(self, button):
        self.calls.append(("release", button))

    def update(self):
        pass

    def buttons(self):
        return [c for c in self.calls if c[0] in ("press", "release")]


class ParseTests(unittest.TestCase):
    def test_control_packet(self):
        self.assertEqual(parse_packet(b"v1,42,-0.5,0.75,0"), ControlPacket(42, -0.5, 0.75, 0.0))

    def test_clamps_values(self):
        self.assertEqual(parse_packet(b"v1,1,-3,2,-1"), ControlPacket(1, -1.0, 1.0, 0.0))

    def test_event_packet(self):
        self.assertEqual(parse_packet(b"evt,12,shift_up,tap"), EventPacket(12, "shift_up", "tap"))
        self.assertEqual(parse_packet(b"evt,13,horn,down").phase, "down")

    def test_rejects_malformed(self):
        for bad in (b"", b"v1", b"v1,1,0,0", b"v1,-1,0,0,0", b"v1,x,0,0,0", b"v1,1,nan,0,0",
                    b"v1,1,inf,0,0", b"v1,1,a,0,0", b"v2,1,0,0,0", b"evt,1,horn,hold",
                    b"evt,x,horn,tap", b"evt,1,,tap", b"evt,1,Horn!,tap", b"\xff\xfe", b"ack,30"):
            self.assertIsNone(parse_packet(bad), bad)


class DedupeTests(unittest.TestCase):
    def test_repeats_and_senders(self):
        deduper = EventDeduper(size=2)
        a, b = ("1.2.3.4", 5), ("5.6.7.8", 5)
        self.assertTrue(deduper.is_new(a, 1))
        self.assertFalse(deduper.is_new(a, 1))
        self.assertFalse(deduper.is_new(a, 1))
        self.assertTrue(deduper.is_new(b, 1))
        deduper.is_new(a, 2)
        deduper.is_new(a, 3)  # evicts 1
        self.assertTrue(deduper.is_new(a, 1))


class MergeTests(unittest.TestCase):
    def test_max_and_missing(self):
        self.assertEqual(merge_pedals((0.2, 0.9), (0.5, 0.1)), (0.5, 0.9))
        self.assertEqual(merge_pedals(None, (0.5, 0.1)), (0.5, 0.1))
        self.assertEqual(merge_pedals((0.3, 0.4), None), (0.3, 0.4))
        self.assertEqual(merge_pedals(None, None), (0.0, 0.0))


class WatchdogTests(unittest.TestCase):
    def test_timeout(self):
        clock = FakeClock()
        watchdog = Watchdog(0.25, clock)
        self.assertTrue(watchdog.expired())
        watchdog.feed()
        clock.advance(0.25)
        self.assertFalse(watchdog.expired())
        clock.advance(0.01)
        self.assertTrue(watchdog.expired())

    def test_driver_goes_neutral_and_releases_held(self):
        clock, backend = FakeClock(), RecordingBackend()
        driver = Driver(backend, clock)
        driver.handle_control(ControlPacket(1, 0.5, 0.8, 0.0))
        driver.handle_event(EventPacket(1, "horn", "down"))
        clock.advance(0.2)
        driver.tick()
        self.assertNotIn(("release", "A"), backend.calls)
        clock.advance(0.1)
        driver.tick()
        self.assertEqual(backend.calls[-2:], [("axes", 0.0, 0.0, 0.0), ("release", "A")])
        backend.calls.clear()
        clock.advance(1)
        driver.tick()  # already neutral: nothing repeats
        self.assertEqual(backend.calls, [])


class DriverTests(unittest.TestCase):
    def setUp(self):
        self.clock, self.backend = FakeClock(), RecordingBackend()
        self.driver = Driver(self.backend, self.clock)
        self.driver.handle_control(ControlPacket(0, 0, 0, 0))

    def test_tap_releases_after_60ms(self):
        self.driver.handle_event(EventPacket(1, "shift_up", "tap"))
        self.assertEqual(self.backend.buttons(), [("press", "RB")])
        self.clock.advance(TAP_SECONDS - 0.001)
        self.driver.tick()
        self.assertEqual(self.backend.buttons(), [("press", "RB")])
        self.clock.advance(0.002)
        self.driver.tick()
        self.assertEqual(self.backend.buttons(), [("press", "RB"), ("release", "RB")])

    def test_repeated_tap_extends_press(self):
        self.driver.handle_event(EventPacket(1, "shift_up", "tap"))
        self.clock.advance(0.04)
        self.driver.handle_event(EventPacket(2, "shift_up", "tap"))
        self.clock.advance(0.03)
        self.driver.tick()  # first tap's release is superseded
        self.assertNotIn(("release", "RB"), self.backend.calls)
        self.clock.advance(0.04)
        self.driver.tick()
        self.assertEqual(self.backend.buttons()[-1], ("release", "RB"))

    def test_held_down_up(self):
        self.driver.handle_event(EventPacket(1, "look_back", "down"))
        self.clock.advance(0.1)
        self.driver.handle_control(ControlPacket(1, 0, 0, 0))
        self.driver.tick()
        self.assertEqual(self.backend.buttons(), [("press", "B")])
        self.driver.handle_event(EventPacket(2, "look_back", "up"))
        self.assertEqual(self.backend.buttons(), [("press", "B"), ("release", "B")])

    def test_unknown_command_ignored(self):
        self.assertIsNone(self.driver.handle_event(EventPacket(1, "launch_control", "tap")))
        self.assertEqual(self.backend.buttons(), [])

    def test_axes_merge_and_invert(self):
        driver = Driver(self.backend, self.clock, invert_steer=True)
        driver.handle_control(ControlPacket(5, 0.25, 0.1, 0.0), arduino=(0.6, 0.3))
        self.assertEqual(self.backend.calls[-1], ("axes", -0.25, 0.6, 0.3))


class DryRunTests(unittest.TestCase):
    def test_axis_logs_are_throttled(self):
        clock, lines = FakeClock(), []
        backend = DryRunBackend(lines.append, clock)
        for i in range(10):  # 10 updates within 90 ms
            backend.set_axes(i / 10, 0.0, 0.0)
            backend.update()
            clock.advance(0.01)
        self.assertEqual(len(lines), 1)
        clock.advance(0.1)
        backend.set_axes(0.95, 0.0, 0.0)
        backend.update()
        self.assertEqual(len(lines), 2)
        backend.set_axes(0.0, 0.0, 0.0)  # neutral is always logged right away
        backend.update()
        self.assertEqual(len(lines), 3)


if __name__ == "__main__":
    unittest.main()
