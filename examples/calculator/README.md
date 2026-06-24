# calculator — built by Kiln (first-try dogfood)

A simple macOS calculator taken end-to-end through the **whole Kiln pipeline**
(`start → arch → dev → release`) on the **first try** — every artifact real, every
seam machine-verified by `kiln check`.

- **Core:** `Sources/CalcKit` — a pure arithmetic state machine (four operations, Clear, a safe divide-by-zero guard). Headless-testable.
- **App:** `Sources/Calculator` — a SwiftUI window + keyboard wired over the engine.
- **Proof:** `swift test` (the 3 MUST acceptance tests) + `kiln check` green on the full contract chain.

## The pipeline (all real, all verified)
| artifact | stage | status |
|---|---|---|
| `kiln-spec.json` | kiln:start | `ready` |
| `kiln-arch.json` | kiln:arch | `ready_for_build` |
| `kiln-dev.json` + `kiln-artifact-manifest.json` | kiln:dev | `ready_for_release` |
| `kiln-release.json` | kiln:release (Slice 1) | `audit_passed` |

The release **pins the candidate** to the real built binary (`sha256` + `size` of `Calculator.app`'s Mach-O) — "release ships exactly the verified build."

## Build & verify
```bash
swift test                        # 3 MUST acceptance tests (VER-001/002/003)
./scripts/build-app.sh            # assemble + ad-hoc sign build/Calculator.app
./scripts/smoke.sh                # launch-smoke
# from the kiln repo root:
npm run kiln -- check examples/calculator/kiln-spec.json examples/calculator/kiln-arch.json examples/calculator/kiln-dev.json examples/calculator/kiln-artifact-manifest.json examples/calculator/kiln-release.json
```

Developer ID signing, notarization, and the real `direct_download` release are Slice 2 (credential-gated).
