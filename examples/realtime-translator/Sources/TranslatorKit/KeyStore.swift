import Foundation
import Security

/// Secure storage for the user's provider API keys (bring-your-own-key).
/// The app NEVER ships with embedded keys; keys only ever live here.
public protocol KeyStore {
    func save(_ key: String, forProvider provider: String) throws
    func read(forProvider provider: String) throws -> String?
    func delete(forProvider provider: String) throws
}

/// In-memory store for tests and ephemeral use.
public final class InMemoryKeyStore: KeyStore {
    private var storage: [String: String] = [:]
    public init() {}
    public func save(_ key: String, forProvider provider: String) throws { storage[provider] = key }
    public func read(forProvider provider: String) throws -> String? { storage[provider] }
    public func delete(forProvider provider: String) throws { storage[provider] = nil }
}

/// File-backed store with 0600 permissions — the dev fallback for unsigned
/// builds (mirrors a reference app's FileTokenStore). Used by tests to avoid Keychain prompts.
public final class FileKeyStore: KeyStore {
    private let directory: String
    private let fm = FileManager.default
    public init(directory: String) { self.directory = directory }

    private func path(_ provider: String) -> String {
        let safe = provider.replacingOccurrences(of: "/", with: "_")
        return (directory as NSString).appendingPathComponent("\(safe).key")
    }

    public func save(_ key: String, forProvider provider: String) throws {
        try fm.createDirectory(atPath: directory, withIntermediateDirectories: true,
                               attributes: [.posixPermissions: 0o700])
        try Data(key.utf8).write(to: URL(fileURLWithPath: path(provider)), options: .atomic)
        try fm.setAttributes([.posixPermissions: 0o600], ofItemAtPath: path(provider))
    }

    public func read(forProvider provider: String) throws -> String? {
        let p = path(provider)
        guard fm.fileExists(atPath: p) else { return nil }
        return String(data: try Data(contentsOf: URL(fileURLWithPath: p)), encoding: .utf8)
    }

    public func delete(forProvider provider: String) throws {
        let p = path(provider)
        if fm.fileExists(atPath: p) { try fm.removeItem(atPath: p) }
    }
}

/// Keychain-backed store (Security framework) — the real app storage.
/// Not exercised in CI (it would prompt); FileKeyStore covers the tests.
public final class KeychainKeyStore: KeyStore {
    private let service: String
    public init(service: String = "com.kiln.realtimetranslator") { self.service = service }

    public func save(_ key: String, forProvider provider: String) throws {
        let base: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: provider,
        ]
        let data = Data(key.utf8)
        let status = SecItemUpdate(base as CFDictionary, [kSecValueData as String: data] as CFDictionary)
        if status == errSecItemNotFound {
            var add = base
            add[kSecValueData as String] = data
            add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
            let addStatus = SecItemAdd(add as CFDictionary, nil)
            guard addStatus == errSecSuccess else { throw KeyStoreError.keychain(addStatus) }
        } else {
            guard status == errSecSuccess else { throw KeyStoreError.keychain(status) }
        }
    }

    public func read(forProvider provider: String) throws -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: provider,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess, let data = item as? Data else { throw KeyStoreError.keychain(status) }
        return String(data: data, encoding: .utf8)
    }

    public func delete(forProvider provider: String) throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: provider,
        ]
        let status = SecItemDelete(query as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else { throw KeyStoreError.keychain(status) }
    }
}

public enum KeyStoreError: Error, Equatable {
    case keychain(OSStatus)
}
