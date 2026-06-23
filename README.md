# Kiln

> Trust Runtime for vibe-coded apps. Glaze lays on the glaze — Kiln fires it into something you can trust.

Vibe-coding studios (Glaze by Raycast, and peers) solved **generation**: describe an app, get a working native macOS app. Generation is now a commodity.

Kiln closes the gap they left open: **trust**. It sits between *intent* and *finished app* and turns unverified output into verified output — proving an app **does what the user meant** (correctness) and **won't harm them** (safety), for people who can't read code.

It is not a generator. Generation is orchestrated (Claude/Codex); Kiln is the assurance layer around it.

## Status

Early build. First layer in progress: **User Understanding Layer** (phases 0–1 — the only place the human participates; everything below is delegated to an autonomous expert core).

## Docs

- [Design spec](docs/superpowers/specs/2026-06-23-trust-runtime-design.md)
- [Glaze blockers research](docs/research/2026-06-23-glaze-blockers.md)

## Stack

Tauri (Rust shell) + React/TypeScript webview. A separate native launch/trust broker is deferred.
