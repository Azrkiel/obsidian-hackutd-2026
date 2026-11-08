# Monza corner positions from F1 data (W3)

How `fixtures/track_monza.json` was measured (2026-11-08). Run from the repo root with a scratch folder `W`:

1. `python scripts/monza_f1/fetch.py`: finds the OpenF1 Monza qualifying sessions and saves MultiViewer's circuit line (`mv_<year>.json`) to the current folder.
2. `python scripts/monza_f1/laps.py W 10`: saves car_data + location for the 10 fastest drivers' laps of each session (OpenF1, free, ~3.7 Hz).
3. `python scripts/monza_f1/analyze.py W`: projects every sample on the circuit line, sets 0 at the lap start (timing line), scales to 5793 m, and takes medians over the 20 laps per corner (brake onset, slowest point, throttle back). Writes `W/monza_f1.json` (copied to `fixtures/monza_f1_corners.json`).
4. `python scripts/monza_f1/build_fixture.py W fixtures/track_monza.json`: gates from those numbers (rules in the fixture's `_note`), then `scripts/track_sim_reference.py` for the sim reference.

Spread over the 20 laps: brake onset 13 to 23 m (IQR), slowest point 11 to 19 m. The speed-integrated lap is 5734 m vs 5793 (sampling), so positions use the circuit line, not speed.
