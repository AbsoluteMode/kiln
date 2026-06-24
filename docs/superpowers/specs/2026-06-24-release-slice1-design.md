# kiln:release Slice 1 — release contract + candidate pin (schema-first)

> Дизайн утверждён 2026-06-24 (Максим). Следующий шаг — writing-plans.

## Цель
Определить контракт релиза и enforce-нуть **ядро доверия релиза — пин кандидата** («релизим РОВНО тот проверенный билд») уже сейчас, без Apple-кредов и реальных каналов. Режим `audit_only`/`prepare`, никаких внешних действий. Это первый срез принятия `kiln:release` (north-star: `docs/superpowers/specs/2026-06-24-kiln-release-proposal.md`), по тому же playbook, что и `kiln:dev`.

## Зафиксированные решения
- **С artifact-manifest** (минимальным) — иначе пин кандидата не enforce-ится.
- **Manifest — отдельная схема** (`src/core/artifact/`), не зашиваем в kiln-dev.json (Codex). Концептуально — выход dev; в Slice 1 определяем схему + синтетический пример; реальную эмиссию из билда — в Slice 2.
- **Синтетический стабильный пример** для коммита/тестов (реальный `.app`-digest волатилен — нельзя коммитить стабильно); реальный артефакт + `.dmg` → Slice 2.
- **Naming-фиксы (Codex):** `fixed` — truth-term, не overall-статус (в enum его нет); задокументировать соответствие ladder ↔ enum.

## Схема 1 — `kiln-artifact-manifest.json` v1 (`src/core/artifact/manifest.ts`)
```
schemaVersion: string(min1)
manifestRevision: int >= 0
sourceSpec:  { schemaVersion, specRevision:int, contentDigest: string|null }
sourceArch:  { schemaVersion, archRevision:int, contentDigest: string|null }
sourceDev:   { schemaVersion, devRevision:int,  contentDigest: string|null }
artifacts: [ {                          // .min(1)
  id: string(min1),                     // ART-*
  type: enum(app | dmg | pkg | zip | binary),
  path: string(min1),
  sha256: string(min1),                 // "sha256:..."
  size: int >= 0,
  bundleIdentifier: string(min1),
  applicationVersion: string(min1),
  buildNumber: string(min1),
  binaryUUIDs: string[],
  dSYMRefs: string[],
  signingStatus: enum(unsigned | adhoc | developer_id | app_store),
  notarizationStatus: enum(none | submitted | accepted | stapled)
} ]
evidenceIndex: string[]
changeLog: string[]
```
`.strict()` + superRefine: artifact `id` уникальны.

## Схема 2 — `kiln-release.json` v1 (`src/core/release/report.ts`)
```
schemaVersion, releaseRevision:int, releaseId: string(min1),
status: overallStatus,
sourceSpec: { schemaVersion, specRevision, contentDigest:string|null },
sourceArch: { schemaVersion, archRevision, contentDigest:string|null },
sourceDev:  { schemaVersion, devRevision,  contentDigest:string|null, artifactManifestDigest:string|null },
releaseContext: {
  releaseMode: enum(audit_only | prepare | upload | submit | publish),
  maximumExternalAction: enum(none | upload | submit_for_review | make_available),
  authorizedChannelIds: string[],
  authorizedArtifactIds: string[],
  version: string(min1),
  buildNumber: string(min1)
},
releaseIdentity: { applicationName, bundleIdentifier, version, buildNumber },
selectedCandidates: [ { artifactId, sha256, size, bundleIdentifier, applicationVersion, buildNumber } ],
channels: [ { id, type: channelType, required: bool, state: channelState, candidateArtifactId } ],
openReleaseAuthorizations: string[],
intentIssues: string[], architectureIssues: string[], devIssues: string[],
ownerDeclarationIssues: string[], environmentIssues: string[], channelIssues: string[],
evidenceIndex: string[], changeLog: string[]
```
`overallStatus` = `invalid_input | blocked_on_dev | blocked_on_architecture | blocked_on_intent | blocked_on_authorization | blocked_on_owner_declaration | blocked_on_environment | blocked_on_channel | audit_passed | prepared | uploaded | submitted | awaiting_external_review | approved_pending_release | publication_pending | partially_released | released | release_failed | rollback_pending | rolled_back | withdrawn`. (Нет `fixed`.)
`channelType` = `mac_app_store_public | mac_app_store_private | mac_app_store_unlisted | testflight_internal | testflight_external | direct_download | internal_direct | custom_channel`.
`channelState` = `pending | uploaded_processing | ready_for_submission | submitted_for_review | awaiting_external_review | review_issue | approved_pending_release | publication_requested | availability_pending | available_verified | beta_available | failed`.

`.strict()` + superRefine (schema-local инварианты):
- `selectedCandidates.artifactId` и `channels.id` уникальны; каждый `channels.candidateArtifactId` ∈ selectedCandidates.
- **authorization ceiling** (машинно, по МНОЖЕСТВУ допустимых состояний, без упорядочивания): `none` → каналы ∈ {`pending`, `ready_for_submission`, `failed`}; `upload` → то же ∪ {`uploaded_processing`}; `submit_for_review` → то же ∪ {`submitted_for_review`, `awaiting_external_review`, `review_issue`}; `make_available` → любое. Состояние вне множества для текущего `maximumExternalAction` = ошибка.
- **release gate:** `status: "released"` запрещён, если хоть один `required` канал ≠ `available_verified`. (В Slice 1 без реальных каналов `released` недостижим — корректно.)
- `releaseMode: audit_only` → все каналы `pending`.

## Шов (`src/core/seam/validate.ts`)
Добавить `digestDev(dev)` и `digestManifest(manifest)` (= `sha256Canonical`, как `digestIntent`/`digestArch`).
- **`validateManifestAgainstDev(manifest, dev)`:** `manifest.sourceDev` пинит dev (`devRevision` + `contentDigest === digestDev(dev)`); `manifest.sourceSpec`/`sourceArch` равны `dev.sourceSpec`/`sourceArch` (один upstream).
- **`validateReleaseAgainstDev(release, dev, manifest)`:**
  - `dev.status === "ready_for_release"` (иначе release не может стартовать → нарушение).
  - `release.sourceDev` пинит dev (`devRevision` + `contentDigest === digestDev(dev)`); `release.sourceDev.artifactManifestDigest === digestManifest(manifest)`.
  - каждый `release.selectedCandidates[c]` резолвится в `manifest.artifacts[a]` по `artifactId` **И совпадает** по `sha256/size/bundleIdentifier/applicationVersion/buildNumber` (кандидат = ровно тот артефакт).
  - `release.releaseContext.authorizedArtifactIds` ⊇ id выбранных кандидатов.

## CLI (`src/cli`)
- `checkArtifacts(spec, arch, dev?, manifest?, release?)`: при наличии manifest → `validateManifestAgainstDev`; при наличии release → `validateReleaseAgainstDev` (требует dev+manifest; если их нет — `parse_error`/понятная проблема).
- `kiln check <spec> <arch> [dev] [manifest] [release]` (позиционно).
- `kiln digest <file>` авто-детектит: `manifestRevision` → digestManifest; `releaseRevision` → digestRelease; `archRevision` → digestArch; иначе → digestIntent.

## Синтетический пример (стабильный)
- `docs/examples/file-renamer.kiln-artifact-manifest.json`: один артефакт `ART-1` (`type: app`, синтетический фиксированный `sha256`, `bundleIdentifier: com.kiln.renamer`, `applicationVersion: 0.1.0`, `buildNumber: 1`, `signingStatus: adhoc`, `notarizationStatus: none`); пины на file-renamer dev/spec/arch (digest'ы — через `kiln digest`).
- `docs/examples/file-renamer.kiln-release.json`: `releaseMode: audit_only`, `maximumExternalAction: none`, `status: audit_passed`, один канал `{ direct_download, required:true, state: pending, candidateArtifactId: ART-1 }`, `selectedCandidates: [ART-1 совпадает с manifest]`, пины на dev + manifest.
- `kiln check docs/examples/file-renamer.kiln-{spec,arch,dev,artifact-manifest,release}.json` → exit 0 на полной цепочке.

## Тесты (`vitest`)
- `artifact/manifest.test.ts`: валидный пример; reject дублей `ART-*`; reject пустого `artifacts`.
- `release/report.test.ts`: валидный пример; reject `released` при required-канале ≠ available_verified; reject превышения authorization ceiling (`maximumExternalAction:none` + канал `uploaded_processing`); reject `audit_only` + не-`pending` канал.
- `seam/validate.test.ts`: оба примера проходят `validateManifestAgainstDev`/`validateReleaseAgainstDev`; флаги — несовпадение digest dev, несовпадение sha256 кандидата vs manifest, dev.status ≠ ready_for_release, кандидат вне authorizedArtifactIds.
- `cli/check.test.ts`: полная цепочка ok; кросс-пара (release против чужого manifest) → digest_mismatch.

## Команда `commands/release.md` v1 + pipeline
Проза стадии (рантайм): pipeline-позиция и роль (внешнее продвижение); input gate (`dev.status == ready_for_release`, пин кандидата сошёлся, `kiln check` цепочки зелёный); authorization-модель (`releaseMode`/`maximumExternalAction`, никогда не превышать; references, не секреты); candidate immutability (бандл не мутируем; изменение → назад в dev); decision authority (7 классов → routing в start/arch/dev/owner); режимы **только `audit_only`/`prepare`** в Slice 1; выход `kiln-release.json` + enforce через `npm run kiln -- check … manifest release`; truth-rules/лестница и `released` — **прозой, помечено deferred (Slice 2)** (внешние действия, нотаризация, каналы). `pipeline.md`: 4-я стадия `validate` → **`release`** (`start → arch → dev → release`, сквозной гейт `kiln check`).

## Отложено (Slice 2, creds-gated)
Реальный `direct_download` для file-renamer: Developer ID подпись → нотаризация (`xcrun notarytool`) → staple → `.dmg` → Gatekeeper-assess → staging/public download digest-compare → isolated install → availability → `status: released`. Реальная эмиссия artifact-manifest из билда (с настоящим `.app`-digest/dSYM). App Store / TestFlight каналы. Любые внешние действия. Нужны Apple-креды (Developer ID `UVBKCN5PPV` + ASC-ключ через Doppler).

## Definition of Done
1. `src/core/artifact/manifest.ts` + `src/core/release/report.ts` (схемы v1) + парсеры.
2. `digestDev`/`digestManifest` + `validateManifestAgainstDev` + `validateReleaseAgainstDev` в шве.
3. `kiln check`/`digest` расширены на manifest+release.
4. Синтетические `docs/examples/file-renamer.kiln-artifact-manifest.json` + `.kiln-release.json` с реальными (вычисленными) пинами.
5. `kiln check` exit 0 на цепочке spec→arch→dev→manifest→release (реальный запуск-пруф).
6. Новые тесты зелёные; полный `npm test` (vitest) + `tsc` зелёные.
7. `commands/release.md` v1 (проза стадии: input gate, authorization, candidate immutability, audit/prepare режимы, output `kiln-release.json`; внешние действия — прозой под Slice 2) + `pipeline.md` 4-я стадия `release`. Закоммичено.
