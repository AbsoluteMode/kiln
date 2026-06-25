import SwiftUI
import AppKit
import TranslatorKit

struct MenuContent: View {
    @ObservedObject var model: TranslatorViewModel

    var body: some View {
        if model.isRunning {
            Button("Стоп") { model.stop() }
        } else {
            Button("Старт перевода") { model.start() }
        }
        Divider()
        if #available(macOS 14.0, *) {
            SettingsLink { Text("Настройки…") }
        } else {
            Button("Настройки…") { openSettingsLegacy() }
        }
        Button("Выход") { NSApplication.shared.terminate(nil) }
    }

    private func openSettingsLegacy() {
        NSApp.activate(ignoringOtherApps: true)
        NSApp.sendAction(Selector(("showPreferencesWindow:")), to: nil, from: nil)
    }
}
