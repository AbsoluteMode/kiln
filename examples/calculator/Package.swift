// swift-tools-version:6.0
import PackageDescription

let package = Package(
    name: "Calculator",
    platforms: [.macOS("12.0")],
    products: [
        .executable(name: "Calculator", targets: ["Calculator"]),
        .library(name: "CalcKit", targets: ["CalcKit"]),
    ],
    targets: [
        .target(name: "CalcKit", path: "Sources/CalcKit"),
        .executableTarget(name: "Calculator", dependencies: ["CalcKit"], path: "Sources/Calculator"),
        .testTarget(name: "CalcKitTests", dependencies: ["CalcKit"], path: "Tests/CalcKitTests"),
    ],
    swiftLanguageModes: [.v5]
)
