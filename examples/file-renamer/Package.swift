// swift-tools-version:6.0
import PackageDescription

let package = Package(
    name: "FileRenamer",
    platforms: [.macOS("12.0")],
    products: [
        .executable(name: "FileRenamer", targets: ["FileRenamer"]),
        .library(name: "RenameKit", targets: ["RenameKit"]),
    ],
    targets: [
        .target(name: "RenameKit", path: "Sources/RenameKit"),
        .executableTarget(
            name: "FileRenamer",
            dependencies: ["RenameKit"],
            path: "Sources/FileRenamer"
        ),
        .testTarget(
            name: "RenameKitTests",
            dependencies: ["RenameKit"],
            path: "Tests/RenameKitTests"
        ),
    ],
    swiftLanguageModes: [.v5]
)
