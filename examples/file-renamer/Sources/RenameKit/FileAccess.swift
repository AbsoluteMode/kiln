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
