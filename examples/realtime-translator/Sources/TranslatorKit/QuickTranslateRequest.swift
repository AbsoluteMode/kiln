import Foundation

public enum QuickTranslateRequest {
    public static func body(text: String, target: String) -> [String: Any] {
        let reasoning: [String: Any] = [
            "effort": "minimal",
            "exclude": true,
        ]
        let messages: [[String: String]] = [
            [
                "role": "system",
                "content": "You are a translator. Translate the user's text to \(target). Output ONLY the translation — no quotes, no notes, no alternatives.",
            ],
            ["role": "user", "content": text],
        ]
        return [
            "model": "google/gemini-3.5-flash-lite",
            "reasoning": reasoning,
            "messages": messages,
        ]
    }
}
