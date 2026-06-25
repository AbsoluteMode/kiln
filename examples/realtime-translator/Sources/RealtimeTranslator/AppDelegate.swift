import AppKit
import SwiftUI
import ServiceManagement

/// Owns the floating, non-activating subtitle panel (a reference app FloatingDotPanel
/// pattern): always-on-top, never steals focus, click-through.
final class AppDelegate: NSObject, NSApplicationDelegate {
    private var panel: NSPanel?
    private var quickTranslate: QuickTranslateController?

    func applicationDidFinishLaunching(_ notification: Notification) {
        let panel = NSPanel(
            contentRect: NSRect(x: 0, y: 0, width: 760, height: 190),
            styleMask: [.borderless, .nonactivatingPanel],
            backing: .buffered,
            defer: false
        )
        panel.level = .statusBar
        panel.isFloatingPanel = true
        panel.collectionBehavior = [.canJoinAllSpaces, .stationary, .fullScreenAuxiliary]
        panel.backgroundColor = .clear
        panel.isOpaque = false
        panel.hasShadow = false
        panel.ignoresMouseEvents = true
        panel.contentView = NSHostingView(rootView: SubtitleView(model: .shared))

        if let screen = NSScreen.main {
            let visible = screen.visibleFrame
            panel.setFrameOrigin(NSPoint(x: visible.midX - 380, y: visible.minY + 90))
        }
        panel.orderFrontRegardless()
        self.panel = panel

        // Quick Translate: global hotkey (Option+Q) -> type a word/phrase -> instant
        // RU<->EN translation, even over a fullscreen call. A second mode in the same app.
        quickTranslate = QuickTranslateController(keyStore: TranslatorViewModel.defaultKeyStore())

        // Survive reboots: enable launch-at-login once, then the Settings toggle controls it.
        if !UserDefaults.standard.bool(forKey: "didSetupLoginItem") {
            LoginItem.enabled = true
            UserDefaults.standard.set(true, forKey: "didSetupLoginItem")
        }
    }
}

/// Launch-at-login via the modern ServiceManagement API (no separate helper bundle).
enum LoginItem {
    static var enabled: Bool {
        get { SMAppService.mainApp.status == .enabled }
        set {
            do {
                if newValue {
                    if SMAppService.mainApp.status != .enabled { try SMAppService.mainApp.register() }
                } else {
                    try SMAppService.mainApp.unregister()
                }
            } catch {
                // best-effort (e.g. the user toggled it off in System Settings)
            }
        }
    }
}
