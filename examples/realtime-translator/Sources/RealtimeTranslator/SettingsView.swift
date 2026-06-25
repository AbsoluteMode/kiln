import SwiftUI
import TranslatorKit

struct SettingsView: View {
    @ObservedObject var model: TranslatorViewModel
    @State private var keyInput: String = ""
    @State private var launchAtLogin = LoginItem.enabled

    var body: some View {
        Form {
            Section("Запуск") {
                Toggle("Запускать при входе в систему", isOn: $launchAtLogin)
                    .onChange(of: launchAtLogin) { _ in LoginItem.enabled = launchAtLogin }
            }
            Section("Ключ провайдера (bring-your-own-key)") {
                SecureField("OpenAI API key", text: $keyInput)
                Button("Сохранить") {
                    model.saveKey(keyInput)
                    keyInput = ""
                }
                .disabled(keyInput.trimmingCharacters(in: .whitespaces).isEmpty)
                Text(model.hasKey
                     ? "Ключ сохранён."
                     : "Ключа пока нет — перевод не запустится, пока вы не добавите ключ.")
                    .font(.callout)
                    .foregroundStyle(.secondary)
            }
            Section {
                Text("Ключи хранятся локально (~/Library/Application Support, права 0600 — только ваш пользователь). В приложение ключи не встроены.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .formStyle(.grouped)
        .frame(width: 480, height: 340)
    }
}
