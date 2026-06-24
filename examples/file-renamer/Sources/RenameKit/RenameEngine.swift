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
