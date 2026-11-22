# UNIT — PR 1.2: Supabase integration validation

Дата: 2026-11-22. Ветка: `test/private-audio-supabase-validation`.
База: PR #2, `f1a1c2b4ff7ef5fea005ec75d411e0ab3f4510ce`.

**Текущий результат: BLOCKED для полного повторного Supabase HTTP-прогона.**
Текущие SQL/WASM-регрессии прошли; они не заменяют GoTrue/PostgREST/Storage.
Прежний реальный HTTP PASS сохранён как отдельное историческое свидетельство.
Definition of Done PR 1.2 пока не достигнут; новых Critical/High дефектов не
подтверждено, но это не утверждение о полной проверке отсутствия уязвимостей.

## Environment

В этой проверке не было обращений к hosted Supabase и production deployment.
Входное задание содержит устаревшее состояние: до его получения пользователь
отдельно подтвердил восстановление проекта и production cutover. Выполненная
операция описана в `asset-access-live-cutover.md`; повторять её здесь нельзя.

Повторный preflight:

- macOS, Node v22.11.0, Supabase CLI 2.81.3 доступен в npm cache.
- `/usr/local/bin/docker` — битая ссылка на отсутствующий Docker.app.
- Docker socket `/var/run/docker.sock` отсутствует; Docker/Compose не запускаются.
- Colima и OrbStack не обнаружены; работающего локального Docker Engine нет.
- Portable Lima 2.3.0 сохранился от прошлой проверки, но `limactl list` в прежнем
  изолированном LIMA_HOME не находит VM. База, контейнеры и локальные ключи удалены.
- psql/pg_dump не обнаружены в PATH. Порты 55421/55422 не заняты.
- Свободно около 14 GiB. Прежний стек занимал около 12 GiB; новая VM и загрузка
  образов с таким запасом не запускались. Это ресурсное ограничение текущей
  проверки, не доказательство невозможности запуска Supabase на этом компьютере.
- Никакой системный софт не устанавливался, Docker context и пользовательские
  настройки не менялись. Новый облачный проект не создавался.

Предыдущее **реальное** disposable окружение, уже удалённое:
PostgreSQL 17.6.1.095 / GoTrue v2.187.0 / PostgREST v14.5 / Storage v1.41.8 /
Kong 2.8.1; Lima 2.3.0, 3 CPU / 6 GiB RAM; CLI 2.81.3. Оно применяло 22 файла,
а не нынешние 25. Отчёт: `asset-access-native-verification.md`. Его утверждения
о состоянии облака относятся к моменту того теста и не описывают состояние сейчас.

### Воспроизведение после восстановления локального Docker

Нужны работающий локальный Docker Engine с Compose, Node, зависимости репозитория,
порты 55420–55424, достаточное место для образов и запас диска сверх размера стека.
Не использовать production-ключи или hosted URL.

```sh
docker info
docker compose version
npx --yes supabase@2.81.3 --version
# При установленном CLI ровно 2.81.3:
node supabase/tests/asset-access/disposable-local.mjs
# Либо абсолютный путь к уже установленному бинарнику версии 2.81.3:
UNIT_SUPABASE_CLI=/absolute/path/to/supabase node supabase/tests/asset-access/disposable-local.mjs
```

CLI намеренно закреплён на v2.81.3: [changelog CLI v3](https://supabase.com/changelog/supabase-cli-v3) описывает несовместимые изменения; флаги сверены с локальным v2 `--help`, а не перенесены из v3. [Local development guide](https://supabase.com/docs/guides/local-development/cli/getting-started).

Новый runner копирует только SQL-файлы в свежую временную папку с уникальным
project_id, запускает PostgreSQL/Auth/REST/Storage/Kong, сравнивает реальный ledger
с файлами и вызывает существующий `storage-http.mjs`. Не копирует `.env.local`,
не выполняет link/db push, не наследует application/Supabase credentials.
Ключи из локального CLI status остаются в памяти и окружении дочернего теста.
Запрещены remote Docker endpoints и нелокальный API URL; защитные проверки
исходного HTTP-теста сохранены. После запуска удаляются только контейнеры/тома
уникального project_id и его временная папка, без `stop --all`.

Runner прошёл syntax/ESLint и проверку безопасного отказа без Docker. **Полная
ветка bootstrap/start/history/HTTP/cleanup нового runner пока NOT RUN.** После
Docker preflight его необходимо реально выполнить; подготовленный runner не
является самостоятельным доказательством успешной интеграции. Он запускает
имеющуюся HTTP-матрицу, а не автоматически закрывает перечисленные ниже пробелы.

SQL-регрессии без HTTP можно воспроизвести отдельно, установив PGlite 0.3.14
в изолированной временной папке (не меняя package.json UNIT):

```sh
UNIT_PGLITE_MODULE=/absolute/path/to/pglite/dist/index.js node supabase/tests/asset-access/run.mjs
```

## Git и Migration Verification

- PR #1 остаётся Draft/open: base main `f997ee7`, head `225fb23`.
- PR #2 остаётся Draft/open: base PR #1 `225fb23`, head `f1a1c2b`.
- `225fb23` — предок `f1a1c2b`, проверено локально; metadata GitHub совпадает.
- Исходный SHA `02b6555` уже дополнен исправлением INSERT RETURNING `f1a1c2b`.
- Существующие исторические файлы не переписывались.
- Посторонние `next.config.ts`, Dockerfile, .dockerignore, app/api не включены.

Перед PR 1.2 в рабочем дереве остались результаты отдельно утверждённого
согласования истории. Здесь они включены для воспроизводимости 25 файлов:
два импортированных cloud-only SQL под исходными timestamp, новая additive
reconciliation migration и карта cloud→repo. Это не новые production-операции.
Импорт старого task guard временно создаёт второй триггер; финальная reconciliation
удаляет только obsolete `tasks_guard_fields`/`guard_task_fields`, сохраняя
`tasks_guard_columns`. Не останавливаться на промежуточном состоянии свежего replay.

Текущий полный replay 25 файлов в PGlite: **PASS**, включая контроль сохранения
существующих assets, RLS, direct INSERT RETURNING, dry-run и повторный backfill.
Повторный полный native replay 25 файлов: **NOT RUN / BLOCKED**.

Порядок: все baseline timestamp по сортировке (включая два импортированных файла),
затем:

1. `20261122101423_private_audio_db_security.sql` — PR #1.
2. `20261122111038_asset_access_isolation.sql` — PR #2.
3. `20261122115339_asset_owner_returning_access.sql` — корректирующий SELECT.
4. `20261122124948_reconcile_cloud_legacy_history.sql` — согласование legacy.

## Security Matrix

Четыре прежних синтетических HTTP-пользователя: artist A, artist B, label A admin,
label B admin; две организации и anon. Никаких реальных аккаунтов/аудио.
Колонка «прежний HTTP» относится только к сохранённому 22-file native прогону;
все HTTP-пункты в **текущем** запуске NOT RUN.

| Проверка | Expected | Прежний HTTP Actual | Текущий результат / пробел |
|---|---|---|---|
| A: независимый артист | Owner upload/read; лейблы/anon denied | Owner INSERT RETURNING, upload, labels denied; anon проверен позднее | SQL PASS; отдельный ранний anon HTTP шаг отсутствует |
| B: два лейбла без grants | Ни metadata, ни list/download/sign | Обе организации download/sign denied; list проверен для ungranted B позднее | SQL PASS; обе metadata/list HTTP проверки в этой фазе неполны |
| C: explicit grant | Только A получает track/current cover | Signed fetch 200; A download/list; B denied; self-grants denied | SQL PASS |
| D: revoke | Новые select/download/sign denied | Download/sign/cover denied; старый URL вернул 200 | SQL SELECT PASS; HTTP SELECT после revoke отдельно не asserted |
| E: manage | Только title; семь protected полей denied | Title PASS; owner/path/org/artist denied | release_id/kind/created_at HTTP отсутствуют; SQL created_at PASS |
| F: Storage | Read не даёт write в чужую папку | Owner upload/update/move/copy/delete; granted label write/move/delete denied; ungranted B/anon denied | Не полная декартова матрица всех ролей/операций; granted copy в чужую папку HTTP отсутствует |
| G: covers | Только current parent и registered release cover | Current cover/release cover доступны A; neighbor/B denied | SQL release.cover_path spoof PASS; HTTP spoof/revoked release-cover отдельно не asserted |
| H: demo | TUS/progress, metadata, rename/sort/replace/delete | PASS последовательных запросов | Продуктовые TS helpers и fault-injection compensation не запускались |
| I: playback | Private, browser read/write/delete denied | Реальный объект; read/sign denied owner/A/B/anon | SQL browser write/delete/worker PASS; native HTTP upload/delete/list не покрыты |
| J: cross-tenant | Artist B/другой label denied; чужие IDs не дают grant | B self-grant denied; другой label original/cover denied | Artist B не связан с Label B в HTTP fixture; полный сценарий NOT RUN |

Storage `.remove()` иногда возвращает пустой результат вместо ошибки: прежний
тест проверяет последующим owner download, что оригинал сохранился. Разрешённый
читатель может сохранить копию в своей папке — это ожидаемое следствие доступа
к байтам, не нарушение write-изоляции исходника и не DRM.

## Backfill Review

Текущий PGlite: пять legacy assets, два кандидата, один без grant history;
первый backfill выдаёт один grant, повторный ноль. Все исходные поля сохранены.
Прежний native rehearsal: те же пять records с шестью **реальными** Storage
objects; первый INSERT 1, повторный INSERT 0, revoked запись не восстановлена.

| Scenario | Expected | Actual | Result |
|---|---|---|---|
| Корректный release asset | Один view grant | PGlite + прежний native: 1 | PASS |
| Личное демо | Нет grant | Исключено | PASS |
| Конфликт owner/release | Исключить | Исключено | PASS |
| Конфликтующий org_id | Исключить | Предикат проверен чтением SQL; отдельной fixture нет | NOT RUN |
| Нет original Storage object | Исключить | Исключено | PASS |
| Ранее revoked | Не восстанавливать | Revoked остаётся revoked | PASS |
| Неоднозначная association / duplicate original | Исключить | Предикаты есть; отдельного native fixture нет | NOT RUN |
| Валидные demo/release covers | Только точные объекты | Лейбл видит ровно original + 2 covers | PASS |
| Чужая/неверная backfill cover | Исключить | Отдельная backfill fixture отсутствует | NOT RUN |
| Повторный запуск | Нет дубликатов | 0 новых записей | PASS |

Backfill — отдельная opt-in psql-операция, не часть обычных миграций. Транзакция
блокирует assets/grants/releases/artists/objects до выбора и записи; `NOT EXISTS`
учитывает всю историю, включая revoked; unique partial index страхует active pair.
Механизм fail/rollback посередине backfill и многосессионная гонка здесь NOT RUN.
Критерии не расширялись. На dev сначала backup, read-only dry-run и проверка
происхождения кандидатов; затем отдельное разрешение и synthetic rehearsal.

## Security Review / Findings

| Severity | Finding / root cause | Fix / verification | Remaining risk |
|---|---|---|---|
| High, исправлен ранее | INSERT RETURNING не видел новую строку через STABLE lookup | Отдельная 20261122115339; прямой owner predicate в обеих SELECT policies; прежний HTTP и текущий SQL PASS | Исправление обязательно применять вместе с PR #2 |
| High, исправлен ранее | Legacy folder/org membership раскрывал личные оригиналы | Exact-object grants + restrictive policies; прежний HTTP и текущий SQL PASS | Не выпускать PR #1 отдельно от hardening |
| Medium, ограничение платформы | Старые signed URLs не отзываются при revoke | Новые авторизации denied; прежний старый URL HTTP 200 | Короткие TTL; сохранённые копии не отзываются |
| Medium, verification gap | Новая полная 25-file native/HTTP матрица недоступна | Fail-closed runner + этот отчёт | Блокирует завершение PR 1.2 |
| Medium, verification gap | Grant/revoke race и compensation fault injection не проверены | Статически RPC lock одного asset до изменения grants | Нужен multi-connection native тест; не объявлять stress PASS |
| Low, operational | Cleanup remove в upload/replace helpers не проверяет собственный error | Выявлено чтением кода, без нового изменения runtime | Возможен orphan приватного объекта при сетевой ошибке; нужен fault-injection тест |

Проверенные статически границы:

- `can_read/can_manage`: uid, владелец либо active grant, grantor=owner,
  membership в конкретной организации и разрешённая role. Нет LIMIT 1 artist lookup.
- `can_read_object`: exact original/current parent cover/registered release cover;
  mutable release.cover_path сам по себе не authority.
- grant/revoke RPC: обязательная owner-проверка, `FOR UPDATE` одного asset,
  unique active pair. После ожидания concurrent transactions порядок определяется
  выполнением RPC; это не гарантия приоритета revoke над последующей явной выдачей.
- attach RPC: owner asset + owner release, org/artist consistency, owned existing
  original/cover. Атомарно attachment/grant/registry; чужой asset ID не даёт доступ.
- guard_asset — INVOKER, защищает identity/associations, manage сравнивает всю
  строку кроме title; guard_grant — DEFINER, защищает provenance/history.
- Новые DEFINER функции имеют фиксированный пустой search_path, квалифицированные
  имена и явные uid-проверки; EXECUTE не оставлен PUBLIC/anon у новых RPC.
- Прямые grant INSERT/UPDATE браузеру не выданы. SQL direct INSERT denial PASS;
  отдельный direct UPDATE HTTP probe отсутствует.
- `audio_share_link_metadata` намеренно owner-executed security-barrier view:
  явный owner=auth.uid(), только безопасные колонки, без token/PIN hashes, session
  secrets и путей. Перевод в invoker сломал бы доступ к скрытым private tables.
- `unit_audio_backend`: NOLOGIN/NOBYPASSRLS, не член browser roles; role не
  передаётся через frontend API. Привилегии worker проверены SQL, не новым native run.
- Приватный release-cover registry без browser grants/policies — намеренный deny.

Security Advisors в disposable экземпляре недоступны: локальный стек не запущен,
hosted Advisors не использовались вместо него. Любые ранее записанные hosted
warnings не являются результатом этой проверки.

## Quality Gates

Запуски в отдельной копии tracked HEAD + трёх согласующих SQL-файлов. Посторонние
изменения конфигурации/API и `.env.local` не копировались. Node dependencies
клонированы локально; сетевого доступа к production для сборки не требовалось.

| Команда | Результат |
|---|---|
| `npx tsc --noEmit` | PASS |
| `npm run lint` | FAIL baseline: 36 errors / 34 warnings |
| `npm run build` | BLOCKED: Turbopack internal PostCSS process / bind port / EPERM, включая повтор вне sandbox |
| `npm run build -- --webpack` | PASS |
| Targeted ESLint: test runners + затронутые Supabase TS helpers | PASS, 0 findings |
| `node --check .../disposable-local.mjs` | PASS |
| Новый bootstrap без Docker | Безопасный отказ до создания среды; не HTTP PASS |

`git diff --cached --check` отмечает только две исходные пустые строки EOF в импортированных cloud-only SQL; их тела сохранены без переписывания. Новых whitespace-замечаний в runner/отчёте нет.

Исходный lint baseline сохранён; посторонние ошибки не исправлялись. SQL-файлы
проверены replay, не ESLint. Next configuration ради окружения не менялась.

## Deployment Plan — dev only, не выполнен здесь

1. Сравнить backup/schema/history целевого dev с repo, не запускать слепой db push.
2. Применить только отсутствующие baseline, PR #1, PR #2, RETURNING correction,
   reconciliation в timestamp-порядке; старые cloud-only записи не replay на live.
3. Проверить фактические RLS, EXECUTE, private schemas, buckets, ledger и сохранность
   старых assets; нужен полный disposable HTTP PASS до дальнейшего cutover.
4. Read-only dry-run; отдельное утверждение backfill. Ноль автоматических grants
   из security-миграций, никаких fallback folder-wide policies.
5. В согласованное окно backfill + совместимый frontend с attach RPC; проверить
   реальных dev owner/label пользователей, clean versions, covers и кабинеты.
6. Не возвращаться к старому frontend с raw assets.release_id UPDATE: он несовместим
   с guard. Не откатывать доступность за счёт ослабления приватности.

Никаких production apply/deploy/merge в рамках PR 1.2.

## Readiness

| Область | Статус | Основание |
|---|---|---|
| Объединение PR #1 + #2 | BLOCKED для полного sign-off PR 1.2 | Нужен повторный native 25-file replay и закрытие HTTP-пробелов; PR #1 отдельно раскрытие оригиналов не исправляет |
| Применение на изолированном dev | READY WITH LIMITATIONS | Только отсутствующие migrations, RETURNING fix обязателен; backfill отдельно; не production |
| Разработка Media Pipeline | READY WITH LIMITATIONS | Основа схемы проверена ранее native и сейчас SQL; расширенная integration validation остаётся gate перед выпуском |
| Публичный Private Music Player | BLOCKED | Pipeline/API/player вне задачи и не реализованы; нет полной PR 1.2 матрицы |

Приложение и публичный player не разрабатывались. Новых production исправлений
в этом PR нет. Подготовлены воспроизводимый local runner и честный отчёт BLOCKED.
