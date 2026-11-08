"""Pull the fastest Monza qualifying laps from OpenF1 (car_data + location), save raw JSON per lap."""
import json
import sys
import time
import urllib.request
from datetime import datetime, timedelta
from pathlib import Path

try:
    import truststore
    truststore.inject_into_ssl()
except ImportError:
    pass

W = Path(sys.argv[1])
N = int(sys.argv[2]) if len(sys.argv) > 2 else 10


def get(url):
    for i in range(4):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "pitpal-research"})
            with urllib.request.urlopen(req, timeout=90) as r:
                return json.loads(r.read())
        except Exception as e:  # noqa: BLE001
            print("retry", i, e, url[:100])
            time.sleep(2 + 3 * i)
    raise RuntimeError(url)


def iso(d):
    return d.strftime("%Y-%m-%dT%H:%M:%S.%f")


for sk in (9908, 9586):
    laps = [l for l in get(f"https://api.openf1.org/v1/laps?session_key={sk}") if l.get("lap_duration")
            and l.get("date_start") and not l.get("is_pit_out_lap")]
    laps.sort(key=lambda l: l["lap_duration"])
    seen, pick = set(), []
    for l in laps:  # one lap per driver: the field's best laps
        if l["driver_number"] in seen:
            continue
        seen.add(l["driver_number"])
        pick.append(l)
        if len(pick) == N:
            break
    print(sk, [(l["driver_number"], l["lap_duration"]) for l in pick])
    for l in pick:
        f = W / f"lap_{sk}_{l['driver_number']}.json"
        if f.exists():
            continue
        t0 = datetime.fromisoformat(l["date_start"].replace("Z", "+00:00")).replace(tzinfo=None)
        a, b = iso(t0 - timedelta(seconds=2)), iso(t0 + timedelta(seconds=l["lap_duration"] + 2))
        q = f"session_key={sk}&driver_number={l['driver_number']}&date>={a}&date<={b}"
        car = get(f"https://api.openf1.org/v1/car_data?{q}")
        loc = get(f"https://api.openf1.org/v1/location?{q}")
        json.dump({"lap": l, "car": car, "loc": loc}, open(f, "w"))
        print("  saved", f.name, len(car), len(loc))
        time.sleep(0.5)
