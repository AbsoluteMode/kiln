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
        let rule = Rule(find: find, replace: replace)
        do {
            let ops = try FileAccess.plan(files: files, rule: rule)
            undo.record(try FileAccess.apply(ops))
            message = "Renamed \(ops.count) file(s)"
            files = files.map { file in
                let newName = RenameEngine.computePreview(files: [file], rule: rule)[0].newName
                return LoadedFile(url: file.url.deletingLastPathComponent().appendingPathComponent(newName))
            }
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
                    Text(row.newName)
                        .fontWeight(row.changed ? .semibold : .regular)
                        .foregroundColor(row.changed ? .accentColor : .primary)
                }
            }
            HStack {
                Button("Apply") { model.apply() }
                    .disabled(model.files.isEmpty || model.hasConflict)
                Button("Undo") { model.undoLast() }
                    .disabled(!model.canUndo)
                if model.hasConflict { Text("Name conflict").foregroundColor(.red) }
            }
        }
        .padding()
    }
}
