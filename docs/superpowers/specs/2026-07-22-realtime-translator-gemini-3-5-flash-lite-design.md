# RealtimeTranslator Quick Translate: Gemini 3.5 Flash-Lite

Date: 2026-07-22

## Goal

Move only the Option+Q Quick Translate path from `z-ai/glm-4.7` to the newly
released `google/gemini-3.5-flash-lite` model, using minimal thinking for the
lowest practical latency. The live system-audio translation path remains on
OpenAI `gpt-realtime-translate` and is out of scope.

## Chosen approach

Keep the existing OpenRouter integration and stored OpenRouter key. Change the
chat-completions payload to:

- model: `google/gemini-3.5-flash-lite`
- reasoning effort: `minimal`
- reasoning excluded from the returned message

Remove the Cerebras provider pin because it was specific to GLM. Let OpenRouter
route the Gemini request to an eligible provider. Keep the existing RU-to-EN /
EN-to-RU direction detection, translation-only system prompt, response parsing,
hotkey, and UI behavior.

This is preferred over calling the Gemini API directly because a direct call
would require a new provider key and Settings changes. A moving "latest" alias
is also rejected because Quick Translate should not change models without a
code change and verification.

## Code boundaries

Extract construction of the Quick Translate request payload into a small,
testable helper in `TranslatorKit`. `QuickTranslateModel` will continue to own
UI state and network execution, while the helper will own the model identifier,
reasoning configuration, provider-independent prompt, and messages.

This boundary allows tests to validate the real serialized payload without
making a network call or exposing API keys.

## Data flow

1. Option+Q opens the existing panel.
2. The user enters a Russian or English word or phrase.
3. Existing Unicode detection chooses English or Russian as the target.
4. The request helper builds an OpenRouter chat-completions payload for
   `google/gemini-3.5-flash-lite` with `reasoning.effort = minimal` and
   `reasoning.exclude = true`.
5. The existing OpenRouter client sends the request and extracts only the first
   assistant message content.
6. The existing UI displays the trimmed translation or its current error text.

## Error handling

Missing OpenRouter keys, transport failures, non-2xx or malformed responses,
and empty input retain their current behavior. No fallback to GLM is added:
silent fallback would make model selection and translation-quality verification
ambiguous.

## Tests and verification

Use test-driven development for the payload helper. The regression test must
first fail against the current GLM payload, then verify that the serialized
request:

- selects `google/gemini-3.5-flash-lite`;
- sends minimal reasoning and excludes reasoning output;
- contains no Cerebras provider pin;
- preserves the translation-only instruction and selected target language.

After the unit suite passes, run the full Swift test suite and release build,
install the rebuilt app in `/Applications`, confirm it launches, and perform a
live Option+Q translation when an OpenRouter key is available. Update the README
to describe the new Quick Translate model and minimal-thinking configuration.

## Sources

- Google model documentation: https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite
- OpenRouter model ID discovered from the live `/api/v1/models` catalog on
  2026-07-22: `google/gemini-3.5-flash-lite`
