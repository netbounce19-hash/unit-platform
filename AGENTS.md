<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Кнопки и линии

Оба кабинета — артиста и лейбла — используют один словарь. Классы пишутся
инлайном (arbitrary-значения Tailwind), отдельного UI-компонента нет; эта
страница и есть спецификация.

## Геометрия

Три радиуса, больше не заводить:

| Радиус | Что |
|---|---|
| `rounded-full` | кнопки с текстом, иконочные кнопки, бейджи, чипсы, пункты навигации |
| `rounded-[12px]` | поля ввода, плитки, плашки-уведомления, зоны загрузки, кнопки с переносом текста |
| `rounded-[16px]` | карточки и панели |

Капсула — только для однострочной подписи. Если текст на кнопке может
перенестись на вторую строку (узкая колонка, длинная подпись), берётся
`rounded-[12px]`: капсула с двумя строками читается как ошибка вёрстки.

Поля ввода не капсулят никогда — скруглённые торцы мешают читать длинный
текст.

## Размер кнопки

Два размера, выбираются по кеглю:

| Размер | Кегль | Паддинг |
|---|---|---|
| `sm` | `text-[13px]` и мельче | `px-[14px] py-[8px]` |
| `md` | `text-[14px]` и крупнее | `px-[18px] py-[10px]` |

Иконочные круглые — `w-8 h-8` в плотных рядах, `w-9 h-9` отдельно стоящие.

## Роли

На экране одна первичная кнопка. Остальные — вторичные или призрачные.

- первичная: `bg-[#E23A34] text-white hover:brightness-95`
- тёмная (подтверждение внутри карточки): `bg-[#17161A] text-white hover:bg-[#2A282E]`
- вторичная: `bg-white border border-[#E5E3DE] hover:border-[#D2D0CB]`
- призрачная: `text-[#6E6D73] hover:text-[#17161A]`
- согласиться: `bg-[#1F9D6B] text-white`
- отклонить: `text-[#A62018] bg-[#FDEDEB] border border-[#F3C9C6]` — заливка мягкая, не сплошная

## Линии

Два веса, и они не взаимозаменяемы:

- `border-[0.5px] border-[#ECEAE5]` — структура: контур карточки, разделитель строк внутри неё
- `border border-[#E5E3DE]` — контур интерактивного элемента: поле ввода, вторичная кнопка
- `border-[#D2D0CB]` — только ховер вторичной кнопки и пунктир зоны загрузки

В тёмной теме лейбла: `#242327` вместо `#ECEAE5`, `#33323A` вместо `#E5E3DE`.
