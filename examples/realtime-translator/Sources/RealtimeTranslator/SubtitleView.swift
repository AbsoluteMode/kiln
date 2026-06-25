import SwiftUI
import TranslatorKit

struct SubtitleView: View {
    @ObservedObject var model: TranslatorViewModel

    var body: some View {
        // Bottom-anchored, left-aligned caption in a rounded box. New text appears at
        // the bottom and the column grows UPWARD up to a MAX of 5 lines; once it would
        // exceed that, the top lines clip out of view. The box is pinned to the bottom,
        // so the newest line never moves — it stays readable.
        let lineHeight: CGFloat = 26  // ~20pt rounded + line spacing
        VStack(alignment: .leading, spacing: 0) {
            Spacer(minLength: 0)
            if !displayText.isEmpty {
                Text(displayText)
                    .font(.system(size: 20, weight: .medium, design: .rounded))
                    .foregroundStyle(.white)
                    .multilineTextAlignment(.leading)
                    .lineSpacing(3)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .frame(maxHeight: lineHeight * 5, alignment: .bottom)  // at most 5 lines
                    .clipped()
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    .background(Color.black.opacity(0.6), in: RoundedRectangle(cornerRadius: 14))
                    .shadow(radius: 5)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
        .padding(10)
    }

    private var displayText: String {
        switch model.state {
        case .idle, .stopped:
            return ""
        case .connecting:
            return "Подключение…"
        case .reconnecting:
            return "Переподключение…"
        case .failed(let category):
            return category == "no_key" ? "Добавьте ключ в Настройках" : "Ошибка соединения"
        case .listening:
            return model.currentLine
        }
    }
}
