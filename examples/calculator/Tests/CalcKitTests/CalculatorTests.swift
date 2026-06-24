import XCTest
@testable import CalcKit

final class CalculatorTests: XCTestCase {
    private func compute(_ a: Int, _ op: CalcOp, _ b: Int) -> String {
        let m = CalculatorModel()
        for d in String(a) { m.inputDigit(Int(String(d))!) }
        m.setOperator(op)
        for d in String(b) { m.inputDigit(Int(String(d))!) }
        m.equals()
        return m.display
    }

    // VER-001 / AT-001: the four basic operations are correct.
    func testFourBasicOperations() {
        XCTAssertEqual(compute(2, .add, 3), "5")
        XCTAssertEqual(compute(9, .subtract, 4), "5")
        XCTAssertEqual(compute(6, .multiply, 7), "42")
        XCTAssertEqual(compute(8, .divide, 2), "4")
    }

    // VER-002 / AT-002: Clear resets the display to 0.
    func testClearResets() {
        let m = CalculatorModel()
        m.inputDigit(7); m.setOperator(.add); m.inputDigit(5)
        m.clear()
        XCTAssertEqual(m.display, "0")
    }

    // VER-003 / AT-003: dividing by zero shows "Error" and the app keeps working.
    func testDivisionByZeroIsSafe() {
        let m = CalculatorModel()
        m.inputDigit(6); m.setOperator(.divide); m.inputDigit(0); m.equals()
        XCTAssertEqual(m.display, "Error")
        m.clear()
        XCTAssertEqual(m.display, "0")
        m.inputDigit(1); m.setOperator(.add); m.inputDigit(1); m.equals()
        XCTAssertEqual(m.display, "2")
    }
}
