# TaskFlow Pro

An offline-first **personal operating system** as a mobile-first **Progressive Web App**: tasks, strength training and
habits in one unified timeline, plus focus timer, markdown notes, cross-domain insights and a widget data bridge.

Built from the TaskFlow Pro PRD with the *Industrial Skeuomorphism* design system (chassis grey `#e0e5ec`, safety-orange
`#ff4757`, neumorphic dual shadows, corner screws, vent slots, LEDs, Inter + JetBrains Mono).

**Stack:** React 18 · TypeScript (strict) · Vite · Zustand · lucide-react · hand-written service worker. No backend,
no network calls, no telemetry. All data stays in the browser.

## Run it

```bash
npm install
npm run dev        # dev server (service worker is only registered in production builds)
npm run build      # typecheck + production build into dist/ (SW precaches every built asset)
npm run preview    # serve dist/ at http://localhost:4173 - use this to test install/offline
npm test           # unit tests (vitest)
npm run smoke      # browser smoke test  (needs `npm run preview` running + Chromium)
npm run flows      # gestures, habits, workouts, backup/restore end-to-end
```

Open it on a phone (same network, `npm run preview`) and use *Share → Add to Home Screen* (iOS) or *Install app*
(Android/Chrome) for the standalone, fully offline experience. **More → Settings → Load 60 days of demo data** fills
the app with a sample routine, habits, tasks and history so heatmaps, ACWR and insights have something to show.

## Feature map (PRD §5)

| Tab | Delivered |
| --- | --- |
| **Today** | 4-card metrics strip (tasks, habit rate, workout state, focus time) · ±21-day date strip with auto-centering · unified chronological stream of tasks + workout + habit slots · free-time dividers (≥15 min) · live current-time marker · swipe right = complete, swipe left = delete (with undo), long-press multi-select + batch Complete/Delete · tap to expand subtasks · Timeline / Kanban board / Eisenhower matrix views · time-blocking (start/end), projects, categories, priorities, reminders, subtasks · recurring tasks (daily/weekdays/weekly/monthly/custom + end date, roll-forward) |
| **Calendar** | Month grid with blue/green/purple/orange dots · prev/next/“Today” · day agenda (`Oct 20 • Tuesday`) · All/Tasks/Workouts/Habits filter · planned routine-day card with inline skip toggle · inline “Add task / Add habit” |
| **Workout** | KG/LB global toggle with instant conversion · routine folders (All/Hypertrophy/Strength/Powerlifting/Fat Loss/Deload), duplicate/delete/edit · rolling split rotation with skip-and-roll-forward · 6-program catalog (PPL, Upper/Lower, Starting Strength 5×5, Powerlifting Peaking, Full Body Shred, Arnold split with supersets) · live logger (session stopwatch, rest timer with ±30s/−15s + chime/haptics/notification, set types `# W D F A RP S`, weight types standard/bodyweight/assisted/cardio with time+distance, RPE & RIR, +2.5 kg/+5 lb overload button, auto-prefill from last session, real-time PR celebration, fatigue 1–5, deload flag, workout survives reload) · Olympic plate calculator (colour-coded KG & LB plates, custom bar, exact remainder) · 1RM estimator (Epley + Brzycki blend, 10-row percentage chart) · ACWR + fatigue deload alert · body measurements with photos · achievements + challenges · history & progress charts |
| **Habits** | Boolean / counter / duration · daily / weekdays / custom frequency · multi-check-in slots (fixed times or interval) each shown on the Today timeline · routine anchoring (completing A prompts B) · streak freezes (2/month) shown with snowflake styling · 90/180/365-day GitHub-style heatmap, per habit or combined |
| **More** | Pomodoro 25/5 · 50/10 · 90/20 with task linking and synthesised ambient soundscapes (rain, white noise, cafe, forest) · markdown notes (folders, search, pin, checklist toolbar, live preview with toggleable checkboxes) · cross-domain insights (workout↔task lift, habit↔workout anchors, circadian peak, power day, deep-work momentum) · widget bridge (`widget-data.json`) with small/medium/lock-screen preview · settings, deterministic JSON backup, all-or-nothing restore, factory reset |

## Architecture

```
src/
  db/          WebDatabase (DatabaseInterface) over localStorage: 17 tables, ON DELETE CASCADE, atomic transactions/replace
  repo/        task / habit / workout / note / pomodoro repositories, backup, seed, demo data  (business rules live here)
  lib/         pure logic: oneRepMax, plates, units, recurrence, timeline builder, insightsEngine, markdown, audio, notifications
  store/       Zustand: useUIStore, useAppStore, useWorkoutStore (live session), usePomodoroStore
  components/  design-system primitives (ui.tsx) + feature components
  screens/     the 5 tabs      modals/  bottom sheets (editors, active workout, plate calc, ...)
public/        manifest, service worker, icons
```

The DB mirrors every mutation into the stores via `db.onChange`, so UI updates are optimistic and instantaneous.

## Where the web build differs from the native PRD

These are platform limits, not omissions:

- **Storage:** `expo-sqlite`/WAL isn't available in browsers, so the PRD's own *web fallback* (`WebDatabase` on `localStorage`) is the engine. The `DatabaseInterface` seam is kept so an IndexedDB/SQLite-WASM backend can drop in. Browsers can evict storage; use **Settings → Protect from auto-clear** and regular JSON backups.
- **Notifications:** Web Notifications fire via the service worker for task reminders, habit slots, rest timers and Pomodoro **while the app is open or backgrounded**. Browsers can't schedule a notification for a fully closed app (the Notification Triggers API is not shipped), so that case is not guaranteed.
- **Audio:** ambient soundscapes are synthesised with Web Audio (no audio assets, works offline, loops seamlessly). Browsers need one user gesture before audio plays; pressing Start provides it.
- **Haptics:** uses the Vibration API (Android/Chrome); iOS Safari ignores it.
- **Widgets:** the web can't render home-screen widgets, so the app writes the daily `widget-data.json` snapshot (local slot + export) and previews the three layouts; the native WidgetKit extension is the PRD's Phase 2.
- **Backup:** exports **all 17 tables** (the PRD text says “12”; exporting everything is the safe superset), with schema version and ISO timestamp, deterministically ordered.
- **Design conflict in the PRD:** §1.3 asks for flat, shadow-free UI while the design-system section specifies neumorphic Industrial Skeuomorphism. The explicit design-system spec was followed.
