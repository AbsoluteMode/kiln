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
