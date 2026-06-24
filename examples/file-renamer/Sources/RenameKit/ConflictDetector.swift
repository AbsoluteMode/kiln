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
