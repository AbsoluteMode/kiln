# File-Renamer Real Build (kiln:dev build stage) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate the file-renamer macOS app as a Swift Package from its arch contract, prove the 3 MUST acceptance tests with real `swift test`, build + launch-smoke a real `.app`, emit a real `kiln-dev.json`, and `kiln check` green on the real artifacts.

**Architecture:** Pure Swift Package (validated by `an internal reference app`): a `RenameKit` library (deterministic core — preview/conflict/undo/file-ops), a `FileRenamer` SwiftUI executable, and a `RenameKitTests` test target. The `.app` is assembled manually from the SPM binary and ad-hoc signed.

**Tech Stack:** Swift 6.0 toolchain (language mode v5), SwiftUI/AppKit, XCTest, `os.Logger`. No external dependencies.

## Global Constraints

- `// swift-tools-version:6.0`; `swiftLanguageModes: [.v5]`; `platforms: [.macOS("12.0")]`.
- Zero external package dependencies.
- Everything lives under `examples/file-renamer/`. It is NOT part of `npm test`/`tsc` (separate toolchain); its proof is `swift test` + the real `kiln-dev.json`.
- Trace to the REAL contract ids only: arch components `CMP-UI` `CMP-ENGINE` `CMP-FILES` `CMP-UNDO`; interfaces `IF-1` `IF-2` `IF-3`; verifications `VER-001` `VER-002` `VER-003`. Intent: MUST `REQ-001` `REQ-002` `REQ-003`, journey `JRN-001`, capability `CAP-001`.
- Observability: the app MUST wire `os_log subsystem com.kiln.renamer` (the arch's `reliability.observability`), so the seam's `loggingImplemented ⊇ observability` holds.
- `.app` assembly: manual (`Contents/MacOS` + `Info.plist`) + `codesign --force --sign -` (ad-hoc). NO `install_name_tool` rpath fixup (no embedded frameworks).
- Deferred (do NOT attempt): signing with Developer ID, notarization, stapling, XCUITest/UI tests, accessibility, sanitizers, performance, dSYM, the three sibling artifacts.
- Commit after every task.

---

### Task 1: Scaffold the Swift Package + copy contracts

**Files:**
- Create: `examples/file-renamer/Package.swift`
- Create: `examples/file-renamer/Sources/RenameKit/Models.swift`
- Create: `examples/file-renamer/kiln-spec.json` (copy), `examples/file-renamer/kiln-arch.json` (copy)
- Create: `examples/file-renamer/.gitignore`

**Interfaces:**
- Produces: `LoadedFile(url: URL)` with `.url: URL`, `.originalName: String`; `Rule(find: String, replace: String)`; `PreviewRow(originalName: String, newName: String)` with computed `.changed: Bool`.

- [ ] **Step 1: Create the package manifest**

`examples/file-renamer/Package.swift`:
```swift
// swift-tools-version:6.0
import PackageDescription

let package = Package(
    name: "FileRenamer",
    platforms: [.macOS("12.0")],
    products: [
        .executable(name: "FileRenamer", targets: ["FileRenamer"]),
        .library(name: "RenameKit", targets: ["RenameKit"]),
    ],
    targets: [
        .target(name: "RenameKit", path: "Sources/RenameKit"),
        .executableTarget(
            name: "FileRenamer",
            dependencies: ["RenameKit"],
            path: "Sources/FileRenamer"
        ),
        .testTarget(
            name: "RenameKitTests",
            dependencies: ["RenameKit"],
            path: "Tests/RenameKitTests"
        ),
    ],
    swiftLanguageModes: [.v5]
)
```

- [ ] **Step 2: Create the models**

`examples/file-renamer/Sources/RenameKit/Models.swift`:
```swift
import Foundation

public struct LoadedFile: Equatable {
    public let url: URL
    public let originalName: String
    public init(url: URL) {
        self.url = url
        self.originalName = url.lastPathComponent
    }
}

public struct Rule: Equatable {
    public let find: String
    public let replace: String
    public init(find: String, replace: String) {
        self.find = find
        self.replace = replace
    }
}

public struct PreviewRow: Equatable {
    public let originalName: String
    public let newName: String
    public init(originalName: String, newName: String) {
        self.originalName = originalName
        self.newName = newName
    }
    public var changed: Bool { newName != originalName }
}
```

- [ ] **Step 3: Copy the consumed contracts next to the build**

Run:
```bash
mkdir -p examples/file-renamer
cp docs/examples/file-renamer.kiln-spec.json examples/file-renamer/kiln-spec.json
cp docs/examples/file-renamer.kiln-arch.json examples/file-renamer/kiln-arch.json
printf '.build/\nbuild/\n*.app/\n' > examples/file-renamer/.gitignore
```

- [ ] **Step 4: Verify it builds**

Run: `cd examples/file-renamer && swift build`
Expected: `Build complete!` (RenameKit compiles; FileRenamer/test targets have no sources yet — SwiftPM builds the library).

- [ ] **Step 5: Commit**

```bash
git add examples/file-renamer/Package.swift examples/file-renamer/Sources/RenameKit/Models.swift examples/file-renamer/kiln-spec.json examples/file-renamer/kiln-arch.json examples/file-renamer/.gitignore
git commit -m "feat(file-renamer): scaffold Swift Package + models + copy contracts"
```

---

### Task 2: RenameEngine — live preview (VER-001 / AT-001)

**Files:**
- Create: `examples/file-renamer/Sources/RenameKit/RenameEngine.swift`
- Test: `examples/file-renamer/Tests/RenameKitTests/LivePreviewTests.swift`

**Interfaces:**
- Consumes: `LoadedFile`, `Rule`, `PreviewRow`.
- Produces: `RenameEngine.computePreview(files: [LoadedFile], rule: Rule) -> [PreviewRow]` — a pure function (no I/O).

- [ ] **Step 1: Write the failing test**

`examples/file-renamer/Tests/RenameKitTests/LivePreviewTests.swift`:
```swift
import XCTest
@testable import RenameKit

final class LivePreviewTests: XCTestCase {
    private func file(_ name: String) -> LoadedFile {
        LoadedFile(url: URL(fileURLWithPath: "/tmp/never-touched/\(name)"))
    }

    // VER-001 / AT-001: preview updates live, changes highlighted, no file modified.
    func testPreviewIsPureAndFlagsChanges() {
        let files = (1...10).map { file("photo\($0).txt") }
        let preview = RenameEngine.computePreview(files: files, rule: Rule(find: "photo", replace: "img"))
        XCTAssertEqual(preview.count, 10)
        XCTAssertEqual(preview[0].newName, "img1.txt")
        XCTAssertTrue(preview.allSatisfy { $0.changed })
        // purity: nothing on disk was created/touched (paths are fictional, fn does no I/O)
        XCTAssertFalse(FileManager.default.fileExists(atPath: "/tmp/never-touched/photo1.txt"))
    }

    func testEmptyFindLeavesNamesUnchanged() {
        let preview = RenameEngine.computePreview(files: [file("a.txt")], rule: Rule(find: "", replace: "x"))
        XCTAssertFalse(preview[0].changed)
        XCTAssertEqual(preview[0].newName, "a.txt")
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd examples/file-renamer && swift test --filter LivePreviewTests`
Expected: compile FAIL — `RenameEngine` not found.

- [ ] **Step 3: Write the minimal implementation**

`examples/file-renamer/Sources/RenameKit/RenameEngine.swift`:
```swift
import Foundation

/// CMP-ENGINE: live preview is a pure function of (files, rule). No disk I/O.
public enum RenameEngine {
    public static func computePreview(files: [LoadedFile], rule: Rule) -> [PreviewRow] {
        files.map { file in
            let newName = rule.find.isEmpty
                ? file.originalName
                : file.originalName.replacingOccurrences(of: rule.find, with: rule.replace)
            return PreviewRow(originalName: file.originalName, newName: newName)
        }
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd examples/file-renamer && swift test --filter LivePreviewTests`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add examples/file-renamer/Sources/RenameKit/RenameEngine.swift examples/file-renamer/Tests/RenameKitTests/LivePreviewTests.swift
git commit -m "feat(file-renamer): live preview engine (VER-001)"
```

---

### Task 3: ConflictDetector + FileAccess.plan — conflict block (VER-003 / AT-003)

**Files:**
- Create: `examples/file-renamer/Sources/RenameKit/ConflictDetector.swift`
- Create: `examples/file-renamer/Sources/RenameKit/FileAccess.swift`
- Test: `examples/file-renamer/Tests/RenameKitTests/ConflictTests.swift`

**Interfaces:**
- Consumes: `RenameEngine`, `PreviewRow`, `LoadedFile`, `Rule`.
- Produces:
  - `ConflictDetector.conflicts(in: [PreviewRow]) -> [String]`; `ConflictDetector.hasConflicts(_: [PreviewRow]) -> Bool`.
  - `RenameOperation(from: URL, to: URL)`; `enum RenameError: Error, Equatable { case conflict([String]); case ioFailure(String) }`.
  - `FileAccess.plan(files: [LoadedFile], rule: Rule) throws -> [RenameOperation]` (throws `.conflict` on collision; does NO disk I/O).

- [ ] **Step 1: Write the failing test**

`examples/file-renamer/Tests/RenameKitTests/ConflictTests.swift`:
```swift
import XCTest
@testable import RenameKit

final class ConflictTests: XCTestCase {
    private var dir: URL!

    override func setUpWithError() throws {
        dir = FileManager.default.temporaryDirectory
            .appendingPathComponent("rk-conflict-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    }
    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: dir)
    }

    // VER-003 / AT-003: two files map to one name -> Apply blocked, no file changed.
    func testConflictBlocksPlanAndLeavesFilesUntouched() throws {
        try Data().write(to: dir.appendingPathComponent("file1.txt"))
        try Data().write(to: dir.appendingPathComponent("file2.txt"))
        let files = ["file1.txt", "file2.txt"].map { LoadedFile(url: dir.appendingPathComponent($0)) }
        let rule = Rule(find: "1", replace: "2") // file1.txt -> file2.txt collides with file2.txt

        let preview = RenameEngine.computePreview(files: files, rule: rule)
        XCTAssertTrue(ConflictDetector.hasConflicts(preview))

        XCTAssertThrowsError(try FileAccess.plan(files: files, rule: rule)) { error in
            XCTAssertEqual(error as? RenameError, .conflict(["file2.txt"]))
        }
        // both original files still present, unchanged
        XCTAssertTrue(FileManager.default.fileExists(atPath: dir.appendingPathComponent("file1.txt").path))
        XCTAssertTrue(FileManager.default.fileExists(atPath: dir.appendingPathComponent("file2.txt").path))
    }

    func testNoConflictPlansChangedFilesOnly() throws {
        let files = ["a.txt", "b.txt"].map { LoadedFile(url: dir.appendingPathComponent($0)) }
        let ops = try FileAccess.plan(files: files, rule: Rule(find: ".txt", replace: ".md"))
        XCTAssertEqual(ops.count, 2)
        XCTAssertEqual(ops[0].to.lastPathComponent, "a.md")
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd examples/file-renamer && swift test --filter ConflictTests`
Expected: compile FAIL — `ConflictDetector` / `FileAccess` not found.

- [ ] **Step 3: Write the conflict detector**

`examples/file-renamer/Sources/RenameKit/ConflictDetector.swift`:
```swift
import Foundation

/// CMP-ENGINE: detect target-name collisions before any write.
public enum ConflictDetector {
    /// Target names that more than one file would resolve to.
    public static func conflicts(in preview: [PreviewRow]) -> [String] {
        var counts: [String: Int] = [:]
        for row in preview { counts[row.newName, default: 0] += 1 }
        return counts.filter { $0.value > 1 }.keys.sorted()
    }

    public static func hasConflicts(_ preview: [PreviewRow]) -> Bool {
        !conflicts(in: preview).isEmpty
    }
}
```

- [ ] **Step 4: Write the plan builder**

`examples/file-renamer/Sources/RenameKit/FileAccess.swift`:
```swift
import Foundation
import os

/// CMP-FILES: turn (files, rule) into concrete rename operations and apply them.
public struct RenameOperation: Equatable {
    public let from: URL
    public let to: URL
    public init(from: URL, to: URL) { self.from = from; self.to = to }
}

public enum RenameError: Error, Equatable {
    case conflict([String])
    case ioFailure(String)
}

public enum FileAccess {
    static let log = Logger(subsystem: "com.kiln.renamer", category: "fileaccess")

    /// Build rename operations; throws `.conflict` if any collision. Does NO disk I/O.
    public static func plan(files: [LoadedFile], rule: Rule) throws -> [RenameOperation] {
        let preview = RenameEngine.computePreview(files: files, rule: rule)
        let conflicts = ConflictDetector.conflicts(in: preview)
        guard conflicts.isEmpty else {
            log.error("apply blocked: \(conflicts.count, privacy: .public) conflict(s)")
            throw RenameError.conflict(conflicts)
        }
        return zip(files, preview).compactMap { file, row in
            guard row.changed else { return nil }
            let to = file.url.deletingLastPathComponent().appendingPathComponent(row.newName)
            return RenameOperation(from: file.url, to: to)
        }
    }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd examples/file-renamer && swift test --filter ConflictTests`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add examples/file-renamer/Sources/RenameKit/ConflictDetector.swift examples/file-renamer/Sources/RenameKit/FileAccess.swift examples/file-renamer/Tests/RenameKitTests/ConflictTests.swift
git commit -m "feat(file-renamer): conflict detection + apply plan (VER-003)"
```

---

### Task 4: FileAccess.apply + UndoStack — undo (VER-002 / AT-002)

**Files:**
- Modify: `examples/file-renamer/Sources/RenameKit/FileAccess.swift` (add `apply`)
- Create: `examples/file-renamer/Sources/RenameKit/UndoStack.swift`
- Test: `examples/file-renamer/Tests/RenameKitTests/UndoTests.swift`

**Interfaces:**
- Consumes: `RenameOperation`, `RenameError`, `FileAccess.plan`.
- Produces:
  - `FileAccess.apply(_ ops: [RenameOperation]) throws -> [RenameOperation]` — performs the moves on disk; returns the INVERSE operations (for undo); rolls back on failure.
  - `final class UndoStack` with `record(_ inverse: [RenameOperation])`, `var canUndo: Bool`, `@discardableResult func undo() throws -> Bool`.

- [ ] **Step 1: Write the failing test**

`examples/file-renamer/Tests/RenameKitTests/UndoTests.swift`:
```swift
import XCTest
@testable import RenameKit

final class UndoTests: XCTestCase {
    private var dir: URL!

    override func setUpWithError() throws {
        dir = FileManager.default.temporaryDirectory
            .appendingPathComponent("rk-undo-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    }
    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: dir)
    }

    // VER-002 / AT-002: after an applied batch, undo restores every original name.
    func testUndoRestoresOriginalNames() throws {
        let names = ["a.txt", "b.txt", "c.txt"]
        for n in names { try Data().write(to: dir.appendingPathComponent(n)) }
        let files = names.map { LoadedFile(url: dir.appendingPathComponent($0)) }

        let ops = try FileAccess.plan(files: files, rule: Rule(find: ".txt", replace: ".md"))
        let undo = UndoStack()
        undo.record(try FileAccess.apply(ops))

        XCTAssertTrue(FileManager.default.fileExists(atPath: dir.appendingPathComponent("a.md").path))
        XCTAssertTrue(undo.canUndo)

        XCTAssertTrue(try undo.undo())
        for n in names {
            XCTAssertTrue(FileManager.default.fileExists(atPath: dir.appendingPathComponent(n).path), "\(n) restored")
        }
        XCTAssertFalse(FileManager.default.fileExists(atPath: dir.appendingPathComponent("a.md").path))
        XCTAssertFalse(undo.canUndo)
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd examples/file-renamer && swift test --filter UndoTests`
Expected: compile FAIL — `FileAccess.apply` / `UndoStack` not found.

- [ ] **Step 3: Add `apply` to FileAccess**

Append inside the `FileAccess` enum in `examples/file-renamer/Sources/RenameKit/FileAccess.swift` (after `plan`):
```swift
    /// Apply moves on disk; return the inverse ops for undo. Rolls back on failure.
    @discardableResult
    public static func apply(_ ops: [RenameOperation]) throws -> [RenameOperation] {
        let fm = FileManager.default
        var inverse: [RenameOperation] = []
        do {
            for op in ops {
                try fm.moveItem(at: op.from, to: op.to)
                inverse.append(RenameOperation(from: op.to, to: op.from))
            }
        } catch {
            for inv in inverse.reversed() { try? fm.moveItem(at: inv.from, to: inv.to) }
            log.error("apply failed, rolled back \(inverse.count, privacy: .public) op(s)")
            throw RenameError.ioFailure(String(describing: error))
        }
        log.info("applied \(ops.count, privacy: .public) rename(s)")
        return inverse
    }
```

- [ ] **Step 4: Write the undo stack**

`examples/file-renamer/Sources/RenameKit/UndoStack.swift`:
```swift
import Foundation

/// CMP-UNDO: stack of applied batches; undo replays the inverse operations.
public final class UndoStack {
    private var batches: [[RenameOperation]] = []
    public init() {}

    public func record(_ inverse: [RenameOperation]) { batches.append(inverse) }

    public var canUndo: Bool { !batches.isEmpty }

    @discardableResult
    public func undo() throws -> Bool {
        guard let inverse = batches.popLast() else { return false }
        _ = try FileAccess.apply(inverse)
        return true
    }
}
```

- [ ] **Step 5: Run all tests**

Run: `cd examples/file-renamer && swift test`
Expected: PASS — all three MUST suites green (LivePreview, Conflict, Undo).

- [ ] **Step 6: Commit**

```bash
git add examples/file-renamer/Sources/RenameKit/FileAccess.swift examples/file-renamer/Sources/RenameKit/UndoStack.swift examples/file-renamer/Tests/RenameKitTests/UndoTests.swift
git commit -m "feat(file-renamer): apply + undo stack (VER-002)"
```

---

### Task 5: SwiftUI app shell (CMP-UI) — executable target

**Files:**
- Create: `examples/file-renamer/Sources/FileRenamer/FileRenamerApp.swift`
- Create: `examples/file-renamer/Sources/FileRenamer/FileTableView.swift`

**Interfaces:**
- Consumes: `RenameKit` (`LoadedFile`, `Rule`, `RenameEngine`, `ConflictDetector`, `FileAccess`, `UndoStack`, `RenameError`).
- Produces: a launchable `FileRenamer` executable (`@main`).

- [ ] **Step 1: Write the app entry point**

`examples/file-renamer/Sources/FileRenamer/FileRenamerApp.swift`:
```swift
import SwiftUI

@main
struct FileRenamerApp: App {
    var body: some Scene {
        WindowGroup("File Renamer") {
            ContentView()
                .frame(minWidth: 640, minHeight: 420)
        }
    }
}
```

- [ ] **Step 2: Write the view (wires the real core)**

`examples/file-renamer/Sources/FileRenamer/FileTableView.swift`:
```swift
import SwiftUI
import AppKit
import RenameKit

@MainActor
final class RenamerModel: ObservableObject {
    @Published var files: [LoadedFile] = []
    @Published var find: String = ""
    @Published var replace: String = ""
    @Published var message: String = ""
    private let undo = UndoStack()

    var preview: [PreviewRow] {
        RenameEngine.computePreview(files: files, rule: Rule(find: find, replace: replace))
    }
    var hasConflict: Bool { ConflictDetector.hasConflicts(preview) }
    var canUndo: Bool { undo.canUndo }

    func chooseFolder() {
        let panel = NSOpenPanel()
        panel.canChooseDirectories = true
        panel.canChooseFiles = false
        panel.allowsMultipleSelection = false
        guard panel.runModal() == .OK, let dir = panel.url else { return }
        let contents = (try? FileManager.default.contentsOfDirectory(
            at: dir, includingPropertiesForKeys: nil)) ?? []
        files = contents.filter { !$0.hasDirectoryPath }.map { LoadedFile(url: $0) }
        message = "Loaded \(files.count) file(s)"
    }

    func apply() {
        do {
            let ops = try FileAccess.plan(files: files, rule: Rule(find: find, replace: replace))
            undo.record(try FileAccess.apply(ops))
            message = "Renamed \(ops.count) file(s)"
            files = files.map { LoadedFile(url: $0.url.deletingLastPathComponent()
                .appendingPathComponent(
                    RenameEngine.computePreview(files: [$0], rule: Rule(find: find, replace: replace))[0].newName)) }
        } catch RenameError.conflict(let names) {
            message = "Blocked: \(names.count) name conflict(s)"
        } catch {
            message = "Error: \(error)"
        }
    }

    func undoLast() {
        message = (try? undo.undo()) == true ? "Undid last batch" : "Nothing to undo"
    }
}

struct ContentView: View {
    @StateObject private var model = RenamerModel()

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Button("Choose Folder…") { model.chooseFolder() }
                Spacer()
                Text(model.message).foregroundColor(.secondary)
            }
            HStack {
                TextField("Find", text: $model.find).textFieldStyle(.roundedBorder)
                TextField("Replace", text: $model.replace).textFieldStyle(.roundedBorder)
            }
            List(Array(model.preview.enumerated()), id: \.offset) { _, row in
                HStack {
                    Text(row.originalName).foregroundColor(.secondary)
                    Image(systemName: "arrow.right").foregroundColor(.secondary)
                    Text(row.newName).fontWeight(row.changed ? .semibold : .regular)
                        .foregroundColor(row.changed ? .accentColor : .primary)
                }
            }
            HStack {
                Button("Apply") { model.apply() }.disabled(model.files.isEmpty || model.hasConflict)
                Button("Undo") { model.undoLast() }.disabled(!model.canUndo)
                if model.hasConflict { Text("Name conflict").foregroundColor(.red) }
            }
        }
        .padding()
    }
}
```

- [ ] **Step 3: Build the executable**

Run: `cd examples/file-renamer && swift build`
Expected: `Build complete!` (both `RenameKit` and `FileRenamer` compile, no warnings).

- [ ] **Step 4: Re-run the full test suite (no regressions)**

Run: `cd examples/file-renamer && swift test`
Expected: PASS — all three suites still green.

- [ ] **Step 5: Commit**

```bash
git add examples/file-renamer/Sources/FileRenamer/
git commit -m "feat(file-renamer): SwiftUI app shell wiring the core (CMP-UI)"
```

---

### Task 6: Build the real `.app` + launch-smoke

**Files:**
- Create: `examples/file-renamer/Resources/Info.plist`
- Create: `examples/file-renamer/Resources/FileRenamer.entitlements`
- Create: `examples/file-renamer/scripts/build-app.sh`
- Create: `examples/file-renamer/scripts/smoke.sh`

**Interfaces:**
- Produces: `examples/file-renamer/build/FileRenamer.app` (ad-hoc signed, launchable).

- [ ] **Step 1: Info.plist**

`examples/file-renamer/Resources/Info.plist`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleIdentifier</key>      <string>com.kiln.renamer</string>
    <key>CFBundleName</key>            <string>FileRenamer</string>
    <key>CFBundleExecutable</key>      <string>FileRenamer</string>
    <key>CFBundlePackageType</key>     <string>APPL</string>
    <key>CFBundleVersion</key>         <string>1</string>
    <key>CFBundleShortVersionString</key> <string>0.1.0</string>
    <key>LSMinimumSystemVersion</key>  <string>12.0</string>
    <key>NSHighResolutionCapable</key> <true/>
</dict>
</plist>
```

- [ ] **Step 2: Entitlements (mirrors the arch manifest; applied when signed)**

`examples/file-renamer/Resources/FileRenamer.entitlements`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.app-sandbox</key>                        <true/>
    <key>com.apple.security.files.user-selected.read-write</key>     <true/>
    <key>com.apple.security.files.bookmarks.app-scope</key>          <true/>
</dict>
</plist>
```

- [ ] **Step 3: Build script (manual `.app` assembly + ad-hoc sign)**

`examples/file-renamer/scripts/build-app.sh`:
```bash
#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."

swift build -c release
BIN_DIR="$(swift build -c release --show-bin-path)"
APP="build/FileRenamer.app"

rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp "$BIN_DIR/FileRenamer" "$APP/Contents/MacOS/FileRenamer"
cp Resources/Info.plist "$APP/Contents/Info.plist"

# Ad-hoc sign (no Developer ID). No rpath fixup needed — no embedded frameworks.
codesign --force --sign - --entitlements Resources/FileRenamer.entitlements "$APP"
codesign --verify --verbose "$APP"
echo "Built $APP"
```
Then: `chmod +x examples/file-renamer/scripts/build-app.sh`

- [ ] **Step 4: Smoke script (launch, confirm alive, quit)**

`examples/file-renamer/scripts/smoke.sh`:
```bash
#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
APP="build/FileRenamer.app"

open "$APP"
sleep 3
if pgrep -x FileRenamer >/dev/null; then
    echo "SMOKE OK: FileRenamer launched and is alive"
    osascript -e 'quit app "FileRenamer"' 2>/dev/null || pkill -x FileRenamer || true
    exit 0
else
    echo "SMOKE FAIL: FileRenamer is not running"
    exit 1
fi
```
Then: `chmod +x examples/file-renamer/scripts/smoke.sh`

- [ ] **Step 5: Build + smoke**

Run: `cd examples/file-renamer && ./scripts/build-app.sh && ./scripts/smoke.sh`
Expected: `Built build/FileRenamer.app`, then `SMOKE OK: FileRenamer launched and is alive`.

- [ ] **Step 6: Commit**

```bash
git add examples/file-renamer/Resources/ examples/file-renamer/scripts/
git commit -m "feat(file-renamer): real .app bundle + ad-hoc sign + launch-smoke"
```

---

### Task 7: Real `kiln-dev.json` + `kiln check` green + README

**Files:**
- Create: `examples/file-renamer/kiln-dev.json`
- Create: `examples/file-renamer/build/test.log` (evidence; gitignored — keep the path referenced)
- Create: `examples/file-renamer/README.md`

**Interfaces:**
- Consumes: the kiln CLI (`npm run kiln -- digest`, `npm run kiln -- check`) from the repo root.
- Produces: a real `kiln-dev.json` (`status: ready_for_release`) that passes the seam.

- [ ] **Step 1: Capture real test evidence + the pins**

Run (from repo root `~/eye`):
```bash
mkdir -p examples/file-renamer/build
(cd examples/file-renamer && swift test 2>&1 | tee build/test.log | tail -3)
npm run --silent kiln -- digest examples/file-renamer/kiln-spec.json   # expect sha256:63e8...
npm run --silent kiln -- digest examples/file-renamer/kiln-arch.json   # expect sha256:f892...
```
Expected: tests pass; digests print (`sha256:63e815d1c2f332de63764f57254c3bb98b8a808c07def80bb6a4a350407b8bb3` for spec, `sha256:f892103062882cbed87292da6a71e18853a556cdbaf2f227d8c3ff5281d5ff13` for arch). Use the ACTUAL printed values in the next step (do not hand-copy from here if they differ).

- [ ] **Step 2: Write the real build report**

`examples/file-renamer/kiln-dev.json` (substitute the digests printed in Step 1):
```json
{
  "schemaVersion": "1.0",
  "devRevision": 1,
  "status": "ready_for_release",
  "sourceSpec": { "schemaVersion": "1.0", "specRevision": 1, "contentDigest": "sha256:63e815d1c2f332de63764f57254c3bb98b8a808c07def80bb6a4a350407b8bb3" },
  "sourceArch": { "schemaVersion": "1.0", "archRevision": 1, "contentDigest": "sha256:f892103062882cbed87292da6a71e18853a556cdbaf2f227d8c3ff5281d5ff13" },
  "codexStatus": "off",
  "implementationUnits": [
    { "id": "IMP-ENGINE", "componentId": "CMP-ENGINE", "interfaceIds": ["IF-1"], "tracesTo": ["REQ-001", "REQ-003", "JRN-001"], "files": [ { "path": "Sources/RenameKit/RenameEngine.swift", "symbols": ["RenameEngine"] }, { "path": "Sources/RenameKit/ConflictDetector.swift", "symbols": ["ConflictDetector"] } ], "verificationIds": ["VER-001", "VER-003"], "status": "implemented" },
    { "id": "IMP-FILES", "componentId": "CMP-FILES", "interfaceIds": ["IF-2", "IF-3"], "tracesTo": ["CAP-001"], "files": [ { "path": "Sources/RenameKit/FileAccess.swift", "symbols": ["FileAccess", "RenameOperation"] } ], "verificationIds": ["VER-002"], "status": "implemented" },
    { "id": "IMP-UNDO", "componentId": "CMP-UNDO", "interfaceIds": ["IF-3"], "tracesTo": ["REQ-002"], "files": [ { "path": "Sources/RenameKit/UndoStack.swift", "symbols": ["UndoStack"] } ], "verificationIds": ["VER-002"], "status": "implemented" },
    { "id": "IMP-UI", "componentId": "CMP-UI", "interfaceIds": ["IF-1"], "tracesTo": ["REQ-001", "JRN-001"], "files": [ { "path": "Sources/FileRenamer/FileRenamerApp.swift", "symbols": ["FileRenamerApp"] }, { "path": "Sources/FileRenamer/FileTableView.swift", "symbols": ["ContentView", "RenamerModel"] } ], "verificationIds": [], "status": "implemented" }
  ],
  "verificationResults": [
    { "verificationId": "VER-001", "result": "pass", "evidenceRefs": ["build/test.log"] },
    { "verificationId": "VER-002", "result": "pass", "evidenceRefs": ["build/test.log"] },
    { "verificationId": "VER-003", "result": "pass", "evidenceRefs": ["build/test.log"] }
  ],
  "loggingImplemented": ["os_log subsystem com.kiln.renamer"],
  "defects": [],
  "intentIssues": [],
  "architectureIssues": [],
  "environmentIssues": [],
  "review": {
    "reviewer": "self",
    "verdict": "pass",
    "notes": [
      "3 MUST acceptance tests pass via real `swift test` on disposable tmp fixtures (build/test.log)",
      "FileRenamer.app builds (swift build -c release) and passes launch-smoke",
      "project built as a Swift Package + xcodebuild-compatible (not a standalone .xcodeproj); build tool and intent-delegated packaging preserved",
      "signing/notarization/UI/a11y/sanitizers deferred — no Developer ID; core-logic MVP"
    ]
  },
  "openRisks": ["a previewed-but-unintended rename is recoverable only via in-session undo"],
  "changeLog": ["rev1: first real build of file-renamer from the arch contract"]
}
```

- [ ] **Step 3: Run the executable seam gate on the REAL artifacts**

Run (from repo root): `npm run kiln -- check examples/file-renamer/kiln-spec.json examples/file-renamer/kiln-arch.json examples/file-renamer/kiln-dev.json`
Expected: `OK seam holds - all cross-stage checks passed` (exit 0).

- [ ] **Step 4: Write the showcase README**

`examples/file-renamer/README.md`:
```markdown
# file-renamer — built by Kiln

A safe batch file renamer for macOS, generated from `kiln-arch.json` by the
`kiln:dev` build stage and verified by the executable seam gate.

- **Core:** `Sources/RenameKit` — live preview (pure function), conflict detection, undo.
- **App:** `Sources/FileRenamer` — SwiftUI window wiring the core.
- **Proof:** `swift test` (3 MUST acceptance tests on disposable fixtures) + `kiln check` green on the real spec/arch/dev contracts.

## Build & verify
    swift test                       # 3 MUST acceptance tests
    ./scripts/build-app.sh           # assemble + ad-hoc sign build/FileRenamer.app
    ./scripts/smoke.sh               # launch-smoke
    # from the kiln repo root:
    npm run kiln -- check examples/file-renamer/kiln-spec.json examples/file-renamer/kiln-arch.json examples/file-renamer/kiln-dev.json

Signing, notarization, UI/accessibility/sanitizer tests are deferred (no Developer ID; core-logic MVP).
```

- [ ] **Step 5: Final repo verification (plugin still green)**

Run (from repo root): `npx tsc --noEmit && npx vitest run 2>&1 | tail -3`
Expected: `TSC` clean; all vitest tests pass (the Swift app is outside the TS toolchain, so counts are unchanged).

- [ ] **Step 6: Commit**

```bash
git add examples/file-renamer/kiln-dev.json examples/file-renamer/README.md
git commit -m "feat(file-renamer): real kiln-dev.json + kiln check green on real build artifacts"
```

---

## Self-Review

**Spec coverage:**
- file-renamer / core-logic MVP / Swift Package / committed to `examples/file-renamer/` — Tasks 1–7. ✓
- 3 MUST via real `swift test` — Tasks 2 (VER-001), 3 (VER-003), 4 (VER-002). ✓
- `.app` build + launch-smoke — Task 6. ✓
- Real `kiln-dev.json` + `kiln check` green — Task 7. ✓
- Observability `com.kiln.renamer` wired — Task 3/4 (`FileAccess` `Logger`), asserted by `loggingImplemented`. ✓
- arch-fidelity note (SPM vs .xcodeproj) recorded in `review.notes` — Task 7. ✓
- Deferred items never attempted — entitlements file present but signing stays ad-hoc; no notarization/UI/sanitizers. ✓
- DoD items 1–7 — covered across Tasks 4 (all tests), 6 (build+smoke), 7 (dev.json, check, plugin still green, committed, README). ✓

**Placeholder scan:** every code/test/script step contains complete content; digests in Task 7 are real (computed earlier this session) with an explicit "use the printed values" guard. No TBD/TODO. ✓

**Type consistency:** `LoadedFile(url:)`, `Rule(find:replace:)`, `PreviewRow(originalName:newName:)`, `RenameEngine.computePreview`, `ConflictDetector.conflicts/hasConflicts`, `RenameOperation(from:to:)`, `RenameError.conflict/.ioFailure`, `FileAccess.plan/apply`, `UndoStack.record/canUndo/undo` — names/signatures consistent across Tasks 1–5 and the dev.json symbols in Task 7. ✓
