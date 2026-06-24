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
