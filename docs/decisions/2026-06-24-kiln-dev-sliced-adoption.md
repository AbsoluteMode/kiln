# Принятие kiln:dev срезами (schema-first), а не целиком

## Контекст
Максим предложил детальный скилл `kiln:dev` (~600 строк): полный Apple release-engineering-конвейер — truth rules, authority model, append-only ledger, defect-loop, privacy-safe log-каталог, двусторонняя трассировка, нотаризация/stapling/dSYM/санитайзеры/Gatekeeper/accessibility/perf, ready-gate на `ready_for_user`, плюс 3 новых артефакта (`kiln-verification.json`, `kiln-log-catalog.json`, `kiln-artifact-manifest.json`) и `kiln-trace.jsonl`. Просьба: оценить и, если мы с Codex согласны, имплементировать.

## Решение
Принимаем **срезами, schema-first**, а не прозой целиком. **Slice 1** = v2-контракт `kiln-dev.json` (`src/core/dev/report.ts`) + то, что исполняемый гейт `kiln check` проверяет уже сегодня из JSON-артефактов (резолв ID, MUST-покрытие, пины intent+arch по SHA-256, дисциплина статусов). Конкретные решения:
- **ID-семейства оставили `ARCH-DEC-*`/`IF-*`** (предложенные `ADR-*`/`IFC-*` не вводим).
- **dev останавливается на `ready_for_release`** (release candidate) — статус `released` присваивает только release-стадия; dev не делает внешнее продвижение.
- **Build-артефактную машинерию отложили** (verification/log-catalog/artifact-manifest/trace.jsonl, нотаризация/санитайзеры/dSYM/Gatekeeper/accessibility/perf) — env-gated прозой, пока нет стадии, делающей реальный `.app`.

## Почему
Проза-целиком = ~70% спеки не на чём исполнять (build-стадии нет) → ровно та ловушка «defined-but-never-run», которую мы только что закрыли исполняемым гейтом. К тому же это противоречит **собственному** принципу спеки — «тонкие вертикальные срезы вместо больших непроверенных партий». Schema-first + `kiln check` гарантирует, что каждый принятый кусок **машинно проверяем и доказан запуском**, а не висит декларацией.

## Что оценили
Два независимых прохода, оба → **slice-it**:
- Claude: философия отличная (truth rules, authority, ledger, defect-loop) — берём как путеводную звезду; но scope/enforceability + нестыковки с контрактами требуют срезов.
- Codex: подтвердил все нестыковки с file:line (ADR/IFC vs ARCH-DEC/IF; форма dev; статусы; sourceArch; coverage-поля), дал точную границу «enforce-able сегодня vs нужен реальный build», поймал ошибки Apple-специфики (нотаризация не переписывает бинарь; stapler только app/dmg/pkg; dSYM per-arch+per-binary; санитайзеры на instrumented-сборке; `hardenedRuntime: bool` недостаточно; privacy-manifest-строку нельзя сравнить машинно) и role-creep (dev поглощает validate/release, которые pipeline держит отдельно).
- Ревью Slice 1 Codex'ом нашло 2 рантайм-дыры (юнит без trace проходил MUST-проверку; `external_blocker`-дефект доходил до ready) — закрыты со схемными инвариантами + тестами.

## Отвергли
- **Wholesale prose как «витрина амбиции»** — выглядит внушительно, но 70% не enforced; противоречит тезису валидации Kiln.
- **`ADR-*`/`IFC-*`** — churn по всем примерам и шву без выигрыша.
- **dev поглощает validate/release** (`ready_for_user`, artifact-manifest в dev) — pipeline держит стадии раздельно; смешение ломает границы.

— 2026-06-24, branch `feature/understanding-foundation`, commits `be60e3e` (Slice 1) + текущий (Codex-fixes). Полная спека сохранена как north-star: `docs/superpowers/specs/2026-06-24-kiln-dev-proposal.md`.
