# Glaze by Raycast — карта блокеров (research, 2026-06-23)

> Источник: фоновый research-агент. Легенда: **[FACT]** — со ссылкой; **[INFERENCE]** — рассуждение; **[NO PUBLIC DATA]** — не подтверждено.

## Важная оговорка о методологии
Glaze — закрытая бета (с 4 марта 2026, только Mac). **Реальных негативных отзывов бета-юзеров публично почти нет.** X/Twitter за логином, Reddit засорён одноимённым AI-art-инструментом, YouTube-обзоры не извлекаются текстом. Большинство «блокеров» ниже — **архитектурно-предсказанные**, а не задокументированные сбои. → Это в нашу пользу: у Максима эксклюзивный доступ к бете, он может добыть first-hand то, чего нет у публики.

## 0. Архитектурный baseline (несущий факт)
- **[FACT]** Glaze-приложения поставляются как **bundled Raycast extensions**; Raycast — «оркестратор». ([digitrendz](https://digitrendz.blog/newswire/artificial-intelligence/141967/raycast-glaze-your-all-in-one-vibe-coding-platform/), [glaze.app](https://www.glaze.app/))
- **[FACT]** Расширения Raycast = **Node.js процессы** (WebView + Node + Swift/Rust shell). Стек React/TypeScript/Node — **НЕ нативный Swift**. ([Raycast deep dive](https://www.raycast.com/blog/a-technical-deep-dive-into-the-new-raycast))
- **[FACT — критично]** Расширения **не песочатся** для file I/O и сети. Разрешения только на уровне macOS на родительском процессе Raycast. ([Raycast Security](https://developers.raycast.com/information/security))
- **[INFERENCE]** → Glaze-приложение имеет полный Node runtime (сеть, дочерние процессы, ФС) под уже выданными Raycast TCC-правами. Обещанная гранулярная модель разрешений — **аспирационная, не реализована**.

## TOP-5 блокеров (реальность × закрываемость × «вау»)
1. **Sandbox + capability-permission broker + security scanner** — единственная проблема, единогласная у скептиков, аналитиков И доков Raycast. Их #1 нерешённое. Вау: максимум.
2. **Верификация «реально ли работает»** — прогон приложения, тесты non-happy-path. Бьёт в core thesis risk + режет credit-burn (единственная реальная жалоба юзера). Вау: высокий.
3. **Inter-app data bus / композиция воркфлоу** — архитектурная белая зона; никто (даже Raycast) не говорит. Самый оригинальный заход.
4. **E2E-sync + schema-migration guardrail** — no-sync явно задокументирован; «iterate by re-prompting» молча рушит данные.
5. **Store trust/quality gate** — «бросающееся в глаза молчание» по модерации; human-review не масштабируется на объём AI-приложений.

## Стратегический гвоздь
- **[FACT]** HN: «это Claude Code с лишними шагами», «у Glaze нет рва». ([HN](https://news.ycombinator.com/item?id=47247033))
- **[INFERENCE]** Ров, который они МОГУТ построить — ровно слой доверия/безопасности/интеграции, который они оставили неопределённым. **Наша возможность = их стратегическое слепое пятно.**

## Реальные жалобы (то немногое из первых рук)
- Безопасность: «не могу заставить себя установить неотревьюенный софт с произвольными правами» (lorenzoguerra, HN).
- Credit-burn: «сложные итерации жгут кредиты; на free можно упереться в стену» (Wonder Tools) — и **дебаг = итерация = трата кредитов**.
- Дебаг: «я не буду рядом, когда у родителей это сломается» (HN) — нет точечной починки, только re-prompt.

## Ключевые источники
- [HN тред](https://news.ycombinator.com/item?id=47247033) · [Raycast: введение](https://www.raycast.com/blog/introducing-glaze) · [glaze.app](https://www.glaze.app/)
- [Raycast архитектура](https://www.raycast.com/blog/a-technical-deep-dive-into-the-new-raycast) · [Raycast Security](https://developers.raycast.com/information/security)
- [implicator.ai](https://www.implicator.ai/raycast-launches-glaze-a-platform-for-building-desktop-apps-through-ai-prompts/) · [Wonder Tools (единственный hands-on)](https://wondertools.substack.com/p/glaze-make-your-own-apps)
