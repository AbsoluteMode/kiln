import AppKit
import SwiftUI
import Carbon.HIToolbox
import os
import TranslatorKit

// MARK: - Global hotkey (Carbon RegisterEventHotKey — needs NO Accessibility permission)

final class GlobalHotkey {
    private var hotKeyRef: EventHotKeyRef?
    private var handlerRef: EventHandlerRef?
    private let onPress: () -> Void

    init?(keyCode: UInt32, modifiers: UInt32, onPress: @escaping () -> Void) {
        self.onPress = onPress
        var spec = EventTypeSpec(eventClass: OSType(kEventClassKeyboard), eventKind: UInt32(kEventHotKeyPressed))
        let selfPtr = Unmanaged.passUnretained(self).toOpaque()
        let installed = InstallEventHandler(GetApplicationEventTarget(), { _, _, userData -> OSStatus in
            guard let userData else { return noErr }
            Unmanaged<GlobalHotkey>.fromOpaque(userData).takeUnretainedValue().onPress()
            return noErr
        }, 1, &spec, selfPtr, &handlerRef)
        guard installed == noErr else { return nil }

        let hotKeyID = EventHotKeyID(signature: OSType(0x4B4C4E54), id: 1) // 'KLNT'
        let registered = RegisterEventHotKey(keyCode, modifiers, hotKeyID, GetApplicationEventTarget(), 0, &hotKeyRef)
        guard registered == noErr else { return nil }
    }

    deinit {
        if let hotKeyRef { UnregisterEventHotKey(hotKeyRef) }
        if let handlerRef { RemoveEventHandler(handlerRef) }
    }
}

// MARK: - Model: auto-detect direction + translate via OpenRouter

@MainActor
final class QuickTranslateModel: ObservableObject {
    @Published var input = ""
    @Published var result = ""
    @Published var translating = false

    private let keyStore: KeyStore
    private let log = Logger(subsystem: "com.kiln.realtimetranslator", category: "quick")

    init(keyStore: KeyStore) { self.keyStore = keyStore }

    func reset() { input = ""; result = ""; translating = false }

    func translate() {
        let text = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        guard let key = (try? keyStore.read(forProvider: "openrouter")).flatMap({ $0 }), !key.isEmpty else {
            result = "Нет ключа OpenRouter в Настройках"; return
        }
        // Auto-direction: Cyrillic input -> English; otherwise -> Russian.
        let isCyrillic = text.unicodeScalars.contains { $0.value >= 0x0400 && $0.value <= 0x04FF }
        let target = isCyrillic ? "English" : "Russian"
        translating = true
        result = ""
        log.info("quick translate -> \(target, privacy: .public)")
        Task { [weak self] in
            guard let self else { return }
            let translated = await self.callOpenRouter(key: key, text: text, target: target)
            await MainActor.run {
                self.translating = false
                self.result = translated ?? "Ошибка перевода"
                self.log.info("quick result: \(translated == nil ? "FAILED" : "ok len=\(translated!.count)", privacy: .public)")
            }
        }
    }

    private func callOpenRouter(key: String, text: String, target: String) async -> String? {
        var request = URLRequest(url: URL(string: "https://openrouter.ai/api/v1/chat/completions")!)
        request.httpMethod = "POST"
        request.setValue("Bearer \(key)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let body = QuickTranslateRequest.body(text: text, target: target)
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            let code = (response as? HTTPURLResponse)?.statusCode ?? -1
            if let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let choices = obj["choices"] as? [[String: Any]],
               let message = choices.first?["message"] as? [String: Any],
               let content = message["content"] as? String {
                return content.trimmingCharacters(in: .whitespacesAndNewlines)
            }
            log.error("quick http \(code): \(String(decoding: data, as: UTF8.self).prefix(300), privacy: .public)")
            return nil
        } catch {
            log.error("quick request error: \(error.localizedDescription, privacy: .public)")
            return nil
        }
    }
}

// MARK: - SwiftUI input view

struct QuickTranslateView: View {
    @ObservedObject var model: QuickTranslateModel
    @FocusState private var focused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            TextField("Слово или фраза… (RU→EN или EN→RU автоматически)", text: $model.input)
                .textFieldStyle(.plain)
                .font(.system(size: 22))
                .focused($focused)
                .onSubmit { model.translate() }

            if model.translating {
                Text("Перевожу…").font(.system(size: 18)).foregroundStyle(.secondary)
            } else if !model.result.isEmpty {
                Divider()
                Text(model.result)
                    .font(.system(size: 24, weight: .semibold))
                    .foregroundStyle(.primary)
                    .textSelection(.enabled)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(20)
        .frame(width: 560)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 18))
        .overlay(RoundedRectangle(cornerRadius: 18).strokeBorder(.white.opacity(0.12)))
        .onAppear { focused = true }
    }
}

// MARK: - Panel (must become key to accept typing)

final class QuickTranslatePanel: NSPanel {
    override var canBecomeKey: Bool { true }
}

// MARK: - Controller: hotkey -> show panel over anything (incl. fullscreen) -> Esc closes

@MainActor
final class QuickTranslateController {
    private let model: QuickTranslateModel
    private let panel: QuickTranslatePanel
    private var hotkey: GlobalHotkey?
    private var escMonitor: Any?

    init(keyStore: KeyStore) {
        model = QuickTranslateModel(keyStore: keyStore)
        panel = QuickTranslatePanel(
            contentRect: NSRect(x: 0, y: 0, width: 560, height: 90),
            styleMask: [.titled, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        panel.titleVisibility = .hidden
        panel.titlebarAppearsTransparent = true
        panel.isMovableByWindowBackground = true
        panel.standardWindowButton(.closeButton)?.isHidden = true
        panel.standardWindowButton(.miniaturizeButton)?.isHidden = true
        panel.standardWindowButton(.zoomButton)?.isHidden = true
        panel.isOpaque = false
        panel.backgroundColor = .clear
        panel.hasShadow = true
        panel.level = .modalPanel
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .stationary]
        panel.contentView = NSHostingView(rootView: QuickTranslateView(model: model))

        // Option+Q
        hotkey = GlobalHotkey(keyCode: UInt32(kVK_ANSI_Q), modifiers: UInt32(optionKey)) { [weak self] in
            Task { @MainActor in self?.toggle() }
        }
    }

    func toggle() { panel.isVisible ? hide() : show() }

    func show() {
        model.reset()
        if let screen = NSScreen.main {
            let visible = screen.visibleFrame
            let size = panel.frame.size
            panel.setFrameOrigin(NSPoint(x: visible.midX - size.width / 2, y: visible.midY + 100))
        }
        NSApp.activate(ignoringOtherApps: true)
        panel.makeKeyAndOrderFront(nil)
        escMonitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { [weak self] event in
            if event.keyCode == 53 { self?.hide(); return nil } // Esc
            return event
        }
    }

    func hide() {
        if let escMonitor { NSEvent.removeMonitor(escMonitor); self.escMonitor = nil }
        panel.orderOut(nil)
        NSApp.hide(nil)
    }
}
