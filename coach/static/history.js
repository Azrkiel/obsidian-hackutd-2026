"use strict";
(() => {
  const $ = id => document.getElementById(id);
  const state = {session: null, kind: "laps", cursor: null, next: null, detailCursor: null, detailNext: null, busy: false};
  const sourceName = source => ({ac: "Assetto Corsa", sim: "Simulator", replay: "Replay"}[source] || "Unknown source");
  const date = value => typeof value === "number" && Number.isFinite(value) ? new Date(value * 1000).toLocaleString() : "Time unavailable";
  const number = (value, unit) => typeof value === "number" && Number.isFinite(value) ? `${value.toFixed(2)}${unit}` : "Not recorded";
  function element(tag, text, cls) { const node = document.createElement(tag); if (text !== undefined) node.textContent = String(text); if (cls) node.className = cls; return node; }
  async function request(path, options) { const r = await fetch(path, options); if (!r.ok) throw new Error("History request failed"); return r.json(); }
  function params(detail = false) {
    const query = {limit: detail ? 100 : 20};
    if (detail) { query.session_id = state.session; query.kind = state.kind; if (state.detailCursor) query.cursor = state.detailCursor; }
    else { if ($("source").value) query.source = $("source").value; if (state.cursor) query.cursor = state.cursor; }
    return query;
  }
  function endpoint(query) { const {session_id, ...rest} = query; return (session_id ? `/history/${encodeURIComponent(session_id)}` : "/history") + "?" + new URLSearchParams(rest); }
  function status(data) {
    const st = data.status || data;
    const labels = {disabled: "Cloud history is not configured on this PC.", config_error: "Cloud setup needs attention.", auth_error: "This device needs database access.", offline: "Offline · showing saved history", refreshing: "Refreshing cloud history…", ready: "Connected to cloud history"};
    $("status").textContent = labels[st.state] || "History unavailable";
    $("status").className = "status" + (["auth_error", "config_error", "offline"].includes(st.state) ? " error" : "");
    const needsSetup = ["disabled", "config_error", "auth_error"].includes(st.state);
    $("notice").hidden = !needsSetup;
    $("notice").textContent = needsSetup ? "Set up this PC's cloud profile, then ask the database owner to register its public device identity. Your game and local coach can keep running." : "";
    if (data.cache?.updated_at) $("status").textContent += ` · Saved ${date(data.cache.updated_at)}`;
    if (st.uploads?.pending) $("status").textContent += ` · ${st.uploads.pending} uploads pending`;
    $("refresh").disabled = state.busy || needsSetup;
  }
  async function showSessions() {
    const data = await request(endpoint(params()));
    status(data);
    const list = $("sessions"); list.replaceChildren();
    for (const row of data.items || []) {
      const p = row.payload || row;
      const button = element("button", undefined, "session");
      button.append(element("strong", p.track || "Unknown track"));
      button.append(element("span", `${p.car || "Unknown car"} · ${sourceName(p.source)}`, "meta"));
      button.append(element("span", date(p.started_at ?? row.captured_at), "meta"));
      button.append(element("span", row.device_label || p.device_label || "Registered PC", "meta"));
      button.setAttribute("aria-current", String(state.session === row.session_id));
      button.addEventListener("click", () => selectSession(row.session_id));
      list.append(button);
    }
    if (!data.items?.length) list.append(element("p", data.cache?.state === "not_fetched" ? "Refresh to load cloud history." : "No sessions on this page.", "empty"));
    state.next = data.next_cursor;
    $("sessions-next").disabled = !state.next || state.busy;
    $("sessions-back").disabled = !state.cursor || state.busy;
  }
  async function showDetails() {
    if (!state.session) return;
    const data = await request(endpoint(params(true)));
    const p = data.session?.payload || data.session || {};
    $("details-title").textContent = p.track || "Session";
    $("details-meta").textContent = `${p.car || "Unknown car"} · ${sourceName(p.source)} · ${date(p.started_at)}`;
    $("tabs").hidden = false;
    for (const button of document.querySelectorAll("[data-kind]")) button.setAttribute("aria-pressed", String(button.dataset.kind === state.kind));
    const records = $("records"); records.replaceChildren();
    for (const row of data.items || []) {
      const r = row.payload || row;
      const card = element("article", undefined, "record");
      if (state.kind === "laps") {
        card.append(element("h3", `Lap ${r.lap ?? "—"}`));
        card.append(element("p", r.valid ? number(r.lap_time_s, " s") : `Invalid · ${r.invalid_reason || "Not timed"}`));
        card.append(element("span", `Corner delta: ${number(r.delta_s, " s")}`, "meta"));
      } else if (state.kind === "attempts") {
        card.append(element("h3", r.corner_id || r.attempt_id || "Corner attempt"));
        card.append(element("p", r.valid ? `${number(r.section_s, " s")} · Exit ${number(r.exit_kmh, " km/h")}` : `Invalid · ${r.invalid_reason || "Not scored"}`));
        card.append(element("span", r.role || "Scored attempt", "meta"));
      } else {
        card.append(element("h3", r.corner_id || r.drill_id || "Coaching"));
        card.append(element("p", r.cue || r.summary || "No advice recorded."));
        card.append(element("span", `${r.provider || "Rules"} · ${r.verdict || r.action || "Decision"}`, "meta"));
      }
      records.append(card);
    }
    if (!data.items?.length) records.append(element("p", data.cache?.state === "not_fetched" ? "Loading this session…" : "No results in this category.", "empty"));
    state.detailNext = data.next_cursor;
    $("records-next").hidden = !state.detailNext;
    $("details-freshness").textContent = data.cache?.updated_at ? `Saved ${date(data.cache.updated_at)}` : "";
    status(data);
  }
  async function refresh(detail = false) {
    if (state.busy) return;
    state.busy = true; $("refresh").disabled = true;
    try {
      const result = await request("/history/refresh", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(params(detail))});
      status(result.status);
      if (result.started || result.status.refreshing) {
        for (;;) { await new Promise(resolve => setTimeout(resolve, 400)); const st = await request("/history/status"); status(st); if (!st.refreshing) break; }
      }
      if (detail) await showDetails(); else await showSessions();
    } catch (_) { $("status").textContent = "The local history server is unavailable. Reopen the history viewer and retry."; }
    finally { state.busy = false; $("refresh").disabled = false; }
  }
  async function selectSession(id) { if (state.busy) return; state.session = id; state.detailCursor = null; await showDetails(); await refresh(true); }
  $("refresh").addEventListener("click", () => refresh(Boolean(state.session)));
  $("source").addEventListener("change", async () => { if (state.busy) return; state.cursor = null; state.session = null; await showSessions(); await refresh(); });
  $("sessions-next").addEventListener("click", async () => { if (state.busy) return; state.cursor = state.next; await showSessions(); await refresh(); });
  $("sessions-back").addEventListener("click", async () => { if (state.busy) return; state.cursor = null; await showSessions(); await refresh(); });
  $("records-next").addEventListener("click", async () => { if (state.busy) return; state.detailCursor = state.detailNext; await showDetails(); await refresh(true); });
  for (const button of document.querySelectorAll("[data-kind]")) button.addEventListener("click", async () => { if (state.busy) return; state.kind = button.dataset.kind; state.detailCursor = null; await showDetails(); await refresh(true); });
  showSessions().then(() => refresh()).catch(() => { $("status").textContent = "The local history server is unavailable."; });
})();
