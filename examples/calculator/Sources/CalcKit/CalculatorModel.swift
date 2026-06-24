import Foundation
import os

public enum CalcOp { case add, subtract, multiply, divide }

/// CMP-ENGINE: a pure in-memory calculator state machine. The four basic
/// operations, Clear, and an explicit division-by-zero guard (never crashes).
public final class CalculatorModel {
    public private(set) var display: String = "0"

    private var accumulator: Double?
    private var pendingOp: CalcOp?
    private var typingNumber = false
    private var errored = false
    private let log = Logger(subsystem: "com.kiln.calculator", category: "engine")

    public init() {}

    public func clear() {
        display = "0"
        accumulator = nil
        pendingOp = nil
        typingNumber = false
        errored = false
    }

    public func inputDigit(_ d: Int) {
        if errored { clear() }
        if typingNumber {
            display = (display == "0") ? "\(d)" : display + "\(d)"
        } else {
            display = "\(d)"
            typingNumber = true
        }
    }

    public func inputDecimal() {
        if errored { clear() }
        if !typingNumber {
            display = "0"
            typingNumber = true
        }
        if !display.contains(".") { display += "." }
    }

    public func setOperator(_ op: CalcOp) {
        if errored { return }
        if pendingOp != nil && typingNumber { equals() }
        accumulator = Double(display)
        pendingOp = op
        typingNumber = false
    }

    public func equals() {
        guard let op = pendingOp, let lhs = accumulator, let rhs = Double(display) else { return }
        if op == .divide && rhs == 0 {
            log.notice("division by zero blocked")
            display = "Error"
            errored = true
            pendingOp = nil
            accumulator = nil
            typingNumber = false
            return
        }
        let result: Double
        switch op {
        case .add: result = lhs + rhs
        case .subtract: result = lhs - rhs
        case .multiply: result = lhs * rhs
        case .divide: result = lhs / rhs
        }
        display = Self.format(result)
        accumulator = result
        pendingOp = nil
        typingNumber = false
    }

    static func format(_ v: Double) -> String {
        if v.isNaN || v.isInfinite { return "Error" }
        if v == v.rounded() && abs(v) < 1e15 { return String(Int(v)) }
        return String(v)
    }
}
