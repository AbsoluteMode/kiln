import SwiftUI

struct RealtimeTranslatorApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    private let model = TranslatorViewModel.shared

    var body: some Scene {
        MenuBarExtra("Realtime Translator", systemImage: "captions.bubble") {
            MenuContent(model: model)
        }
        Settings {
            SettingsView(model: model)
        }
    }
}
