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
