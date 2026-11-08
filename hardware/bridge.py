import time
import serial
import serial.tools.list_ports as lp
import vgamepad as vg


def find_port():
    for p in lp.comports():
        d = (p.description or "").lower()
        if p.vid == 0x2341 or "arduino" in d or "ch340" in d or "usb serial" in d:
            return p.device
    return None


pad = vg.VX360Gamepad()
print("Virtual controller ready. Waiting for Arduino...")

while True:
    port = find_port()
    if not port:
        print("No Arduino found, retrying...")
        time.sleep(1)
        continue
    try:
        ser = serial.Serial(port, 115200, timeout=1)
        print("Connected on", port, "- press the pedals")
        last_print = time.time()
        n = 0
        while True:
            line = ser.readline()
            while ser.in_waiting > 40:      # backlog: skip ahead to the newest reading
                line = ser.readline()
            line = line.decode(errors="ignore").strip()
            if not line or line[0] == "#":
                continue
            try:
                g, b = [int(x) for x in line.split(",")]
            except ValueError:
                continue
            g = max(0, min(1000, g))
            b = max(0, min(1000, b))
            pad.right_trigger(value=int(g / 1000 * 255))  # gas
            pad.left_trigger(value=int(b / 1000 * 255))   # brake
            pad.update()
            n += 1
            now = time.time()
            if now - last_print >= 0.5:
                rate = n / (now - last_print)
                print(f"gas {g / 10:5.1f}%   brake {b / 10:5.1f}%   {rate:3.0f} updates/s")
                n = 0
                last_print = now
    except (serial.SerialException, OSError):
        print("Lost connection, retrying...")
        time.sleep(1)
