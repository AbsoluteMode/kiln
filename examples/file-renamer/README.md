# file-renamer — built by Kiln

A safe batch file renamer for macOS, generated from `kiln-arch.json` by the
`kiln:dev` build stage and verified by the executable seam gate. This is a real,
buildable, tested app — the dogfood proof that the Kiln pipeline produces working
software, not just contracts.

- **Core:** `Sources/RenameKit` — live preview (pure function), conflict detection, undo, atomic file ops.
- **App:** `Sources/FileRenamer` — SwiftUI window wiring the core.
- **Proof:** `swift test` (3 MUST acceptance tests on disposable fixtures) + `kiln check` green on the real spec/arch/dev contracts.

## Build & verify
```bash
swift test                       # 3 MUST acceptance tests (VER-001/002/003)
./scripts/build-app.sh           # assemble + ad-hoc sign build/FileRenamer.app
./scripts/smoke.sh               # launch-smoke
# from the kiln repo root:
npm run kiln -- check examples/file-renamer/kiln-spec.json examples/file-renamer/kiln-arch.json examples/file-renamer/kiln-dev.json
```

## Traceability
`CMP-ENGINE` → `RenameEngine`/`ConflictDetector` (VER-001, VER-003) · `CMP-FILES` → `FileAccess` (VER-002) · `CMP-UNDO` → `UndoStack` (VER-002) · `CMP-UI` → SwiftUI shell. Every MUST requirement (`REQ-001/002/003`) is implemented by a traced unit.

Signing, notarization, UI/accessibility/sanitizer tests are deferred (no Developer ID; core-logic MVP).
