# Security

## Reporting a problem

Please report security issues privately through GitHub: the repository's **Security** tab, **Report a
vulnerability**. Do not open a public issue for them.

## What to know when running Pit Pal

- **Secrets stay out of the repo.** API keys (`NVIDIA_API_KEY`, `OPENROUTER_API_KEY`, `NEMOTRON_API_KEY`) go in your
  shell or a local `.env` (see `.env.example`; `.env` is ignored). The SpacetimeDB device token is stored in Windows
  Credential Manager, not in files. `data/` (pairing key, cloud config, history) is ignored by git.
- **The dashboard is local.** The coach listens on `127.0.0.1:8020` by default. Starting it with `--lan` or
  `--host 0.0.0.0` exposes its controls to your network: only do that on a network you trust.
- **Pair the phone.** On shared Wi-Fi, start with `--pairing required` so only a phone that scanned Rev's QR code can
  drive. The pairing link holds the key: keep the dashboard local.
- **The Nemotron tunnel** (`brev port-forward`, `scripts/nemotron_tunnel.sh`) binds `localhost:8000` only.
