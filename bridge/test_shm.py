import mmap, ctypes, time
class P(ctypes.Structure):
    _pack_ = 4
    _fields_ = [("packetId",ctypes.c_int),("gas",ctypes.c_float),("brake",ctypes.c_float),
                ("fuel",ctypes.c_float),("gear",ctypes.c_int),("rpms",ctypes.c_int),
                ("steerAngle",ctypes.c_float),("speedKmh",ctypes.c_float)]
m = mmap.mmap(-1, ctypes.sizeof(P), "Local\\acpmf_physics")
while True:
    p = P.from_buffer_copy(m)
    print(p.packetId, "gas", round(p.gas,2), "brake", round(p.brake,2), "kmh", round(p.speedKmh))
    time.sleep(0.1)
