import json, sys, urllib.request, urllib.parse
try:
    import truststore; truststore.inject_into_ssl()
except ImportError:
    pass
def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "pitpal-research"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())
out = {}
for y in (2025, 2024):
    s = get(f"https://api.openf1.org/v1/sessions?year={y}&circuit_short_name=Monza&session_name=Qualifying")
    print(y, [(x["session_key"], x["date_start"]) for x in s])
    if s: out.setdefault("sessions", []).extend(s)
for y in (2025, 2024):
    try:
        c = get(f"https://api.multiviewer.app/api/v1/circuits/39/{y}")
        json.dump(c, open(f"mv_{y}.json", "w")); print("multiviewer", y, list(c.keys()), len(c.get("x", [])), len(c.get("corners", [])))
    except Exception as e:
        print("multiviewer", y, e)
json.dump(out, open("sessions.json", "w"))
