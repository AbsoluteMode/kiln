// swift-tools-version:6.0
import PackageDescription

let package = Package(
    name: "RealtimeTranslator",
    platforms: [.macOS(.v13)],
    products: [
        .library(name: "TranslatorKit", targets: ["TranslatorKit"]),
        .executable(name: "RealtimeTranslator", targets: ["RealtimeTranslator"]),
    ],
    targets: [
        .target(name: "TranslatorKit"),
        .executableTarget(name: "RealtimeTranslator", dependencies: ["TranslatorKit"]),
        .testTarget(name: "TranslatorKitTests", dependencies: ["TranslatorKit"]),
    ],
    swiftLanguageModes: [.v5]
)
