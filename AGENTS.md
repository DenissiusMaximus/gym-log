# Gym Log — контекст для агента

Особистий щоденник тренувань одного користувача: таблиця «вправа × дата» з вагою в клітинках, групи вправ, графік прогресу вправи, резервна копія у файл. Expo SDK 58, React Native 0.88 (New Architecture), React 19.3 з React Compiler, TypeScript, Expo Router, zustand. Одна кодова база дає дві цілі:

- **Android** — нативний APK (EAS Build). Основний пристрій користувача.
- **iPhone** — веб-застосунок (PWA) на `https://gym-log.denissiusmaximus.workers.dev`. Платного Apple Developer акаунта немає, нативної iOS-збірки не буде.

Команди, збірка, деплой, оновлення версії, де лежать дані — у `README.md`. Тут лише те, чого в коді й README не видно.

## Користувач

- Спілкування українською. Інтерфейс застосунку англійською, усі тексти в `src/lib/strings.ts`, десятковий роздільник — крапка.
- Дизайн для нього головне: Material Design 3, помірний Expressive, синій seed `#0B57D0` (`scripts/gen-theme.mjs`, SchemeVibrant). Власні компоненти в `src/ui/`, без UI-бібліотек.
- Комітити й пушити в `main` (`github.com/DenissiusMaximus/gym-log`) можна без питань після перевіреної зміни.
- Свідомі рішення, які не переглядати без його запиту:
  - стовпці таблиці фіксованої ширини 60, не розтягувати;
  - таблиця не прокручується сама, коли з'являється новий стовпець (`pinnedToEnd` у `WorkoutTable*` не чіпати);
  - кнопки «+» для тренувань немає: праворуч завжди віртуальні стовпці «сьогодні» і «без дати»;
  - у клітинці — максимум ваги з підходів, на графіку — середнє за день;
  - сітка тягнеться до правого краю, донизу — ні; останній рядок таблиці «Add exercise».
- Стара невдала спроба лежить у `D:\repos\GymPlanner` — не чіпати і код звідти не брати.

## Карта коду

- `src/app/` — екрани: `index.tsx` (таблиця, чипи груп, панель введення), `manage.tsx` (вправи, групи, порядок перетягуванням, архів), `exercise/[id].tsx` (графік), `settings.tsx`, `dev.tsx` (панель розробника, 7 дотиків до версії в Settings), `_layout.tsx` (гідрація, тема, Portal, snackbar, банер збою, service worker, журнал падінь).
- `src/data/` — дані:
  - `store.ts` / `useData.ts` — zustand-сховище, джерело правди для UI; кожна дія → `commit(ops)` у чергу `persist.ts` і повертає undo через інверсію операцій.
  - `driver.ts` (SQLite, Android) і `driver.web.ts` (IndexedDB, веб) за одним інтерфейсом. expo-sqlite у вебі навмисно не використовується.
  - `selectors.ts` — мемоізовані селектори (`selectColumnIds`, `selectRowIds`, `selectSeries`, `selectPrevious`).
  - `virtualColumns.ts`, `useColumnDate.ts`, `useUi.ts` (`draftIds`, `today`, `selectedCell`, snackbar).
  - `backup*.ts` — формат копії, валідація, експорт/імпорт; `safetySnapshot.web.ts` — запасний знімок у localStorage.
- `src/features/table/` — `WorkoutTable.tsx` (native) і `WorkoutTable.web.tsx` + `table.module.css` (DOM, CSS sticky) зі спільними `metrics.ts`, `window.ts` (віртуалізація стовпців), `types.ts`.
- `src/features/home/` — `CellSheet.tsx` (немодальна панель введення, власна клавіатура, редуктор `numpad.ts`), `ColumnActions.tsx` (меню стовпця, календар).
- `src/features/chart/` — власний SVG-графік: `chartMath.ts`, `chartLayout.ts`, `ProgressChart.tsx`.
- `src/theme/` — згенерована палітра, токени MD3, пружини `motion.ts`.
- Платформні варіанти — файли `*.web.ts(x)`. Нативні модулі (expo-sqlite, expo-file-system, expo-sharing, expo-document-picker, expo-haptics) імпортуються лише в нативних файлах.

## Інваріанти й пастки

- **Worklets.** Усередині `useAnimatedStyle`, `useDerivedValue`, колбеків жестів і анімацій можна викликати лише функції reanimated/worklets, `Math.*` і функції з директивою `'worklet'`. Звичайна функція там на Android закриває застосунок («Tried to synchronously call a Remote Function»), у вебі помилки не видно. Кольори з прозорістю рахувати в `useMemo` поза worklet (зразок — `src/ui/Chip.tsx`). Стежить тест `src/workletSafety.test.ts` з фікстурою `src/__fixtures__/`.
- **Анімація розміру.** Width/height/margin/padding анімувати лише пружиною без перельоту (`layoutFast`) і з `Math.max(0, …)`: від'ємну ширину Yoga на Android міряє за вмістом, і елемент «дихає». Переліт (`spatial*`) — лише для transform, радіуса й кольору.
- **Таблиця тримає 40 вправ × 300 тренувань.** Кожен стовпець — `React.memo`-слот із підпискою на `entries[workoutId]`; `WorkoutTable` захищений лише стабільністю пропсів. Передавати мемоізовані масиви й `useCallback`; селектор, що повертає новий об'єкт на кожен виклик, у `useData(selector)` напряму не передавати. Перевіряти плавність: `/dev` → «Generate 40x300».
- **Віртуальні стовпці.** «Сьогодні» і «без дати» мають заздалегідь згенеровані id у `useUi.draftIds`; тренування створюється з тим самим id при першій вазі (`setWeights`), тому панель не перемонтовується. Чинність чернетки — лише через `activeDraftDate`. Порожні тренування з минулою датою або без дати прибирає `pruneEmptyWorkouts` (при гідрації, зміні дня, імпорті). Undo, що дав би дві однакові дати, відмовляє зі snackbar.
- **Одна дата — одне тренування.** Проставлення зайнятої дати об'єднує стовпці (`setWorkoutDate`).
- **Дані на iPhone прив'язані до адреси сайту.** Ім'я Worker `gym-log` і піддомен `denissiusmaximus` не міняти; переїзд — лише через експорт/імпорт.
- **APK.** Ключ підпису в EAS (акаунт `denissiusmaximus`), пакет `com.gymlog.app` — не міняти. Перед кожною збіркою збільшувати `android.versionCode`. Квота безкоштовних збірок обмежена: перевіряти зміни в Expo Go, збирати APK пачкою.
- `src/buildInfo.generated.ts` генерує `scripts/stamp.mjs` (і в `postinstall`); у git його немає.
- jest-expo без jsdom: тестувати чисту логіку, DOM-тестів немає.

## Як перевіряти зміну

1. `npm run typecheck`, `npm run lint`, `npm test`, `npm run build:web`.
2. Веб у браузері на ширині телефона (390 і 360 px, обидві теми): зібраний `dist` через `npx serve dist -s` і сценарій у Playwright (`playwright-core`, канал `msedge`). Таблицю знаходити за `[data-w][data-e]` (клітинки), `[data-h]` (заголовки), `[data-n]` (назви), `[data-add]` (рядок додавання); панель — `data-testid="entry-panel"`. Service worker на localhost вимкнений навмисно.
3. Android — Expo Go: `npx expo start --lan`, QR для `exp://<IP>:8081`. Для реальної швидкості — `npx expo start --no-dev --minify`. Падіння в APK пишуться у файл і видні в `/dev` після перезапуску (кнопка «Simulate crash» перевіряє це).

## Стан і відкриті питання (листопад 2026)

Версія 1.0.1: APK зібрано, сайт задеплоєно. Обидві скарги нижче користувач бачив у Expo Go в режимі розробки; чи лишилися вони в APK 1.0.1 — ще не відомо.

- **Таблиця блимає при перемиканні групи на Android.** Зараз на native таблиця перемонтовується з `key` по фільтру, з `entering={FadeIn}` і `useDeferredValue` (`src/app/index.tsx`). Запасний варіант — прибрати `entering`, лишивши `key` (миттєва заміна). Причини, знайдені раніше: провал прозорості раніше за нову таблицю і відставання `bucket` віртуалізації від прокрутки.
- **Пункти нижнього меню реагують із затримкою** («Pick a date…», «Exercises & groups»). `ActionSheet` тепер закриває аркуш і запускає дію через `requestAnimationFrame`; пауза до появи цілі лишилася. Наступний крок — полегшити рендер цілі (дні в `DatePickerDialog` на `PressableSurface`, рядки `ReorderList`).
- У `WorkoutTable.tsx` лишилася локальна копія `withAlpha` — замінити імпортом з `src/ui/color.ts`.
- iPhone-частину (офлайн, збереження в Safari standalone) на реальному iPhone ще не перевіряли.
