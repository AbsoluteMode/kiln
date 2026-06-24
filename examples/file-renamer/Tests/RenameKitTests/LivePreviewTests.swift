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
