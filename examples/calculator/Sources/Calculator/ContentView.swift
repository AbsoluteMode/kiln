import SwiftUI
import AppKit
import CalcKit

@MainActor
final class CalculatorViewModel: ObservableObject {
    @Published var display = "0"
    private let model = CalculatorModel()
    private var monitor: Any?

    func digit(_ d: Int) { model.inputDigit(d); sync() }
    func op(_ o: CalcOp) { model.setOperator(o); sync() }
    func equals() { model.equals(); sync() }
    func clear() { model.clear(); sync() }
    func decimal() { model.inputDecimal(); sync() }
    private func sync() { display = model.display }

    func startKeyboard() {
        guard monitor == nil else { return }
        monitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { [weak self] event in
            guard let self, let c = event.charactersIgnoringModifiers?.first else { return event }
            switch c {
            case "0"..."9": self.digit(Int(String(c))!); return nil
            case "+": self.op(.add); return nil
            case "-": self.op(.subtract); return nil
            case "*", "x": self.op(.multiply); return nil
            case "/": self.op(.divide); return nil
            case "=", "\r": self.equals(); return nil
            case ".": self.decimal(); return nil
            case "\u{1b}": self.clear(); return nil
            default: return event
            }
        }
    }
}

struct CalcButton: View {
    let label: String
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            Text(label)
                .font(.title2)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .buttonStyle(.bordered)
    }
}

struct ContentView: View {
    @StateObject private var vm = CalculatorViewModel()

    private let rows: [[String]] = [
        ["C", "÷", "×", "−"],
        ["7", "8", "9", "+"],
        ["4", "5", "6", "="],
        ["1", "2", "3", "."],
        ["0"],
    ]

    var body: some View {
        VStack(spacing: 8) {
            Text(vm.display)
                .font(.system(size: 44, weight: .light, design: .monospaced))
                .frame(maxWidth: .infinity, alignment: .trailing)
                .lineLimit(1)
                .minimumScaleFactor(0.4)
                .padding(.horizontal, 8)

            VStack(spacing: 8) {
                ForEach(rows.indices, id: \.self) { r in
                    HStack(spacing: 8) {
                        ForEach(rows[r], id: \.self) { label in
                            CalcButton(label: label) { tap(label) }
                        }
                    }
                }
            }
        }
        .padding()
        .onAppear { vm.startKeyboard() }
    }

    private func tap(_ label: String) {
        switch label {
        case "C": vm.clear()
        case "÷": vm.op(.divide)
        case "×": vm.op(.multiply)
        case "−": vm.op(.subtract)
        case "+": vm.op(.add)
        case "=": vm.equals()
        case ".": vm.decimal()
        default:
            if let d = Int(label) { vm.digit(d) }
        }
    }
}
