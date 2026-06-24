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
