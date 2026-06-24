# Build-стадия Kiln — первый реальный билд (file-renamer)

> Дизайн утверждён 2026-06-24 (Максим). Следующий шаг — writing-plans.

## Цель
Доказать магнит Kiln: `kiln:dev` по фиксированному `file-renamer.kiln-arch.json` **реально** рождает рабочее macOS-приложение, а `kiln check` зелёный на **настоящих** артефактах (сгенерированных билдом, не рукописных). Это финальный dogfood — каждый предыдущий контракт (intent → arch → dev → шов → исполняемый гейт) проверяется против реальности.

## Зафиксированные решения
- **App:** file-renamer (ядро детерминировано и реально тестируется — провабельность).
- **Глубина:** core-logic MVP.
- **Структура:** Swift Package (не `.xcodeproj`).
- **Где:** `examples/file-renamer/` в репо (коммитим как showcase), изолировано от `src/`.
- **Окружение (подтверждено):** Xcode 26.4.1, Swift 6.3.1, macOS 27.0 — реальный билд выполним.

## Layout
```
examples/file-renamer/
  kiln-spec.json        # копия docs/examples/file-renamer.kiln-spec.json (идентична → тот же digest)
  kiln-arch.json        # копия (идентична)
  kiln-dev.json         # РЕАЛЬНЫЙ вывод билда (реальные пути, verificationResults из swift test)
  Package.swift
  Sources/
    RenameKit/          # библиотека — чистое ядро (тестируемое headless)
      Models.swift          # LoadedFile, Rule, RenamePlan
      RenameEngine.swift    # CMP-ENGINE: live preview = чистая функция (files, rules) -> plan
      ConflictDetector.swift# CMP-ENGINE: детект коллизий до Apply
      UndoStack.swift       # CMP-UNDO: запись применённого батча + восстановление имён
      FileAccess.swift      # CMP-FILES: атомарный rename на user-selected (без sandbox в юнит-тестах)
    FileRenamer/        # executable target "FileRenamer" — SwiftUI-оболочка (CMP-UI)
      FileRenamerApp.swift  # @main, окно
      FileTableView.swift   # таблица файлов + live preview + Apply
  Tests/
    RenameKitTests/
      LivePreviewTests.swift # VER-001 / AT-001
      UndoTests.swift        # VER-002 / AT-002
      ConflictTests.swift    # VER-003 / AT-003
  README.md             # showcase: «собрано Kiln из arch-контракта»
```
Зависимости (по `arch.system.dependencyRules`): UI → Engine → Files → Undo, без обратных. Тест-таргет зависит только от `RenameKit`.

## Маппинг arch → код
| arch component | модуль | реализует |
|---|---|---|
| CMP-ENGINE | `RenameEngine`, `ConflictDetector` (RenameKit) | live preview (чистая функция), детект коллизий, Apply-план |
| CMP-UNDO | `UndoStack` (RenameKit) | undo-стек применённых батчей |
| CMP-FILES | `FileAccess` (RenameKit) | атомарный rename, security-scoped доступ (рантайм app) |
| CMP-UI | `FileRenamerApp`, `FileTableView` (target FileRenamer) | таблица, превью, Apply-гейт |

## Верификация (реальная, headless)
Все 3 MUST — `swift test` на disposable tmp-фикстурах, создаваемых самим тестом (по правилу «деструктив только на одноразовых данных»):
- **VER-001 / AT-001 — live preview:** дано 10 файлов; правило find/replace; превью обновляется как чистая функция, изменённое подсвечено, **ни один файл не тронут**. (Чистая логика, без I/O.)
- **VER-002 / AT-002 — undo:** применить батч в tmp-папке; вызвать undo; **все оригинальные имена восстановлены**. (Реальный I/O на tmp.)
- **VER-003 / AT-003 — conflict-block:** правило, мапящее два файла в одно имя; Apply **заблокирован**, коллизия показана, **ни один файл не изменён**.

`swift test` даёт **настоящий** pass/fail — это и есть доказательство.

## Сборка `.app` + launch-smoke
- `swift build -c release` (через `xcodebuild` — см. ниже) собирает executable `FileRenamer`.
- Бандлим `FileRenamer.app` (`Contents/MacOS/FileRenamer` + `Info.plist`: bundle id, min macOS, `NSPrincipalClass`).
- Launch-smoke: `open FileRenamer.app`, подтвердить что процесс жив ~2–3с без краша (`pgrep`), затем завершить. Доказывает «запускается без падения»; полная UI-проверка окна — в отложенных UI-тестах. Запуск **ad-hoc/unsigned локально** (нет Developer ID) — на core-logic доказательство не влияет.

## Заземление: sidekey/whytap (проверенные паттерны)
Реальный прод-апп Максима `/Users/maxim/sidekey` собран **целиком как Swift Package** (нет `.xcodeproj`/xcodegen) — это валидирует наш выбор живым шипящим приложением. Забираем:
- `// swift-tools-version:6.0`, `swiftLanguageModes: [.v5]`, `platforms: [.macOS("12.0")]`.
- Таргеты: `.target` (RenameKit) + `.executableTarget` (FileRenamer, deps: RenameKit) + `.testTarget` (RenameKitTests, deps: RenameKit). `@main` работает из executable-таргета.
- **Бандл `.app` вручную** (как `scripts/dev-run.sh`): `swift build -c release` → `--show-bin-path` для бинаря → `mkdir Contents/{MacOS,Resources}` → `cp` бинарь → `Info.plist` (CFBundleIdentifier/Executable/Version/`LSMinimumSystemVersion`) → `codesign --force --sign -` (ad-hoc). **rpath-фиксап НЕ нужен** (он у sidekey только из-за встроенного Sparkle.framework; у нас нет фреймворков).
- Entitlements-файл по arch-манифесту (`app-sandbox` + `files.user-selected.read-write` + `bookmarks.app-scope`) кладём как реальный артефакт; launch-smoke гоняем ad-hoc (sandbox не форсится без подписи, на core-logic не влияет).
- Тесты: `swift test`, `@testable import`, tmp-фикстуры `FileManager.default.temporaryDirectory` + `defer { removeItem }`.
- Отложенное подтверждено их же сетапом: Developer ID (`UVBKCN5PPV`) + `xcrun notarytool` + `xcrun stapler` — ровно то, что env-gate'им.
- Скрипты-сборки кладём в `examples/file-renamer/scripts/` по образцу.

## Реальный `kiln-dev.json` + гейт
Генерим из реального вывода:
- `implementationUnits` — реальные пути (`Sources/RenameKit/RenameEngine.swift` …), трассировка на реальные `CMP-*`/`IF-*` (arch) и `REQ-*`/`JRN-*`/`CAP-*` (intent), `verificationIds` → `VER-*`.
- `verificationResults` — из реального вывода `swift test` (pass/fail), `evidenceRefs` → пути к сохранённому логу теста.
- `sourceSpec`/`sourceArch` — пины через `npm run kiln -- digest` (совпадают с копиями spec/arch).
- `status: ready_for_release` если всё зелёное.
- **`npm run kiln -- check examples/file-renamer/{kiln-spec,kiln-arch,kiln-dev}.json` → exit 0 на РЕАЛЬНЫХ артефактах.** Это кульминация.

## Соответствие arch (нюанс для прозрачности)
`arch.build.project` говорит «Xcode project», `build.commands` — `xcodebuild`. Берём **Swift Package**, но собираем/тестируем через **`xcodebuild`** (он работает против `Package.swift`: `xcodebuild -scheme FileRenamer -destination 'platform=macOS' test`), а `swift test` — headless-эквивалент. Инструмент сборки (`xcodebuild`) и intent-делегирование packaging (`handoff.buildMayDecide` включает «signing and packaging») соблюдены; формат проекта (.xcodeproj → SPM) фиксируем в `review.notes` дев-отчёта с обоснованием. Это **не** `architectureIssue` (намерение arch — собираемое/тестируемое/sandbox-приложение — сохранено). Если по факту окажется иначе — заведём issue, импровизировать не будем.

## Отложено (env-gated, по решению sliced-adoption)
XCUITest/UI-журней, accessibility, санитайзеры (ASan/TSan/UBSan), подпись/нотаризация/stapling (нет Developer ID), Gatekeeper, perf-бюджеты, dSYM-matching, 3 сиблинг-артефакта (verification/log-catalog/artifact-manifest). Всё — прозой под будущий полный билд.

## Что узнаем / ужесточим
Реальный прогон — проверка прозы `kiln:dev`. Если arch недоопределён или контракт неудобен на практике — фиксируем находку (kiln:dev prose / схема), но **не** меняем `kiln-spec.json`/`kiln-arch.json` из dev. `docs/examples/file-renamer.kiln-dev.json` (схемная фикстура для юнит-тестов) при желании позже синхронизируем с реальными путями.

## Связь с репо-тестами
`docs/examples/*` остаются схемными фикстурами (юнит-тесты vitest). `examples/file-renamer/` — самодостаточный реальный showcase. `kiln check` гоняется на обоих наборах. Swift-проект НЕ участвует в `npm test`/`tsc` (отдельный тулчейн); его «тест» — `swift test`, его доказательство фиксируется в реальном `kiln-dev.json`.

## Definition of Done
1. `examples/file-renamer/` собирается (`xcodebuild`/`swift build`) без ошибок и варнингов.
2. `swift test` — зелёный на 3 MUST с реальными доказательствами (лог сохранён).
3. `FileRenamer.app` собран и проходит launch-smoke.
4. Реальный `examples/file-renamer/kiln-dev.json`, `status: ready_for_release`.
5. `npm run kiln -- check examples/file-renamer/{spec,arch,dev}` → exit 0 на реальных артефактах.
6. `npm test` (vitest) и `tsc` всё ещё зелёные (плагин не сломан).
7. Всё закоммичено; README showcase на месте.
