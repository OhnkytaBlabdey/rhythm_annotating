# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development

```bash
pnpm install                # Install dependencies
pnpm dev                    # Next.js dev server (web build, basePath=/rhythm_annotating)
pnpm build                  # Next.js static export → out/ (alias: pnpm build:web)
pnpm lint                   # ESLint (flat config: eslint.config.mjs)
```

No test framework is set up (no jest, vitest, or playwright).

### Desktop (Electron)

```bash
pnpm desktop:start                                                  # Build desktop renderer + launch Electron locally
pnpm desktop:package                                                # Package for current platform (via electron-forge)
pnpm desktop:make                                                   # Create distributable for current platform
pnpm desktop:make:win:x64                                           # Package for a specific platform (also win:arm64, mac:x64, mac:arm64, linux:x64, linux:arm64)
pnpm build:desktop:renderer                                         # Only build the Next.js desktop export → dist-desktop-renderer/
```

Desktop build sets `BUILD_TARGET=desktop` env, which makes Next.js export with no `basePath` (no `/rhythm_annotating` prefix). The build script (`scripts/build-desktop-renderer.mjs`) runs `pnpm build` with that env, then copies `out/` → `dist-desktop-renderer/`.

Electron Forge config is in `forge.config.js`. All `desktop:make:*` scripts use `@electron-forge/maker-zip` (no signing/notarization). The packager excludes `src/`, `public/`, `node_modules/`, `other/`, `test/` from the ASAR — only `dist-desktop-renderer/` is included as an extra resource.

**`.npmrc` requires `node-linker=hoisted`** because Electron's module resolution needs flat `node_modules`.

## Architecture

This is a **local-first rhythm annotation editor** — a Next.js 16 static-export SPA (no SSR), also packaged as an Electron desktop app.

### Build Targets

| Target | `basePath` | Output | Runtime |
|--------|---|-----|-----|
| Web (`pnpm build`) | `/rhythm_annotating` | `out/` | GitHub Pages / static hosting |
| Desktop (`BUILD_TARGET=desktop`) | undefined | `dist-desktop-renderer/` | Electron (`electron/main.cjs`) |

Static export requires `images.unoptimized: true` in `next.config.ts`.

### Electron Runtime

`electron/main.cjs` creates a `BrowserWindow` that loads the renderer via a custom `app://` protocol. The protocol handler resolves files from `dist-desktop-renderer/` with strict path traversal checks (resolves absolute paths then verifies the result stays within the renderer root).

The preload script (`electron/preload.cjs`) exposes `window.desktopRuntime` via `contextBridge` (isElectron, platform, arch, versions).

### Providers & State Architecture

```
layout.tsx → Providers
  Providers → AppSettingsProvider (localStorage-backed settings)
    page.tsx → WorkArea (main orchestrator)
      WorkArea → AudioDataCtx.Provider (audio file list)
```

- **`AppSettingsProvider`** (`src/components/appSettingsContext.tsx`): Persists shortcuts, time view, and spectrum view settings to `localStorage` under key `explicitize.app-settings`. Hydrated synchronously from localStorage on mount (no flash). Versioned schema (currently v2).
- **`AudioDataCtx`** (`src/components/audioContext.ts`): Lightweight React context holding `AudioData[]` — the list of loaded audio files. Components read it to access audio buffers for waveform/spectrum rendering.
- **Project state** (`project` interface): Managed as `useState` in `WorkArea` — includes `currentTime`, `timeMultiplier`, `isPlaying`, `playSpeed`, and `soundLaneStates[]`. Not in a context; passed down as props.

### Persistence (IndexedDB)

Auto-saved 350ms after any project/audio/slice state change. Two object stores in database `explicitize-editor` (v1):

- **`audios`** — keyed by `id`, stores `PersistedAudioRecord` (id, file name, duration, blob, updatedAt)
- **`snapshots`** — keyed by string key (always `"current"`), stores `PersistedProjectSnapshotV1`

**Slice registry** (`src/lib/persistence/sliceRegistry.ts`): Extensible per-feature persistence. Components register a slice (key + getState/applyState + optional serialize/deserialize), and slices are collected into the snapshot alongside the main project state. Currently two slices are registered: `timeView` and `spectrumView`.

**Chart data time serialization**: `ChartSegment.time` is stripped before save (`stripChartDataTimes`) and recomputed on load (`recomputeSegmentTimes`) because times are derived from cumulative measure durations and can be rebuilt deterministically.

### Component Tree

```
layout.tsx → Providers (AppSettingsProvider)
  page.tsx → WorkArea
    WorkMenu (toolbar: time controls, add sound, reset, shortcuts modal, etc.)
    SoundLane[] (one per loaded audio file)
      SoundFileTitleBar
      WaveLane (waveform renderer)
        WaveMenu (amplitude scale, fold)
      NoteLane (chart/note editor)
        Measure (graduation, currentTick)
        NoteMenu (add/delete notes, adjust BPM, scale density, switch text view, etc.)
      SpectrumLane (FFT spectrum via Web Worker)
        SpectrumMenu (palette, brightness, resolution, fold)
```

### Core Data Types

- **`AudioData`** (`src/interface/audioData.ts`): Parsed audio file (id, file name, ArrayBuffer, duration, optional decoded AudioBuffer).
- **`SoundLaneState`**: Per-audio UI state — offset, folded flags, per-lane sub-states (NoteLane/WaveLane/SpectrumLane).
- **`NoteLaneData`** (`src/components/soundArea/noteArea/chartTypes.ts`): Note chart data — array of `ChartSegment` (time + tempo + measures), each measure containing `ChartNote[]`. Notes have a type (strong=0, weak=1, LN=2), optional head/body/tail fractions, and a unique id. Boundary markers (start=-1, end=-2) are stored as special notes within chartData (migrated from deprecated `startTime`/`endTime` fields; `dataVersion` tracks this — currently v3).
- **`project`** (`src/interface/project.ts`): Top-level state — currentTime, timeMultiplier, isPlaying, playSpeed, soundLaneStates[].

### Note Edit State & Modes

`src/components/soundArea/noteArea/noteState.ts` defines the editing system:

- **9 edit modes**: `browse` (read-only), `insert-strong`, `insert-weak`, `insert-ln` (two-click: head then tail), `select`, `paste`, `insert-start`, `insert-end`, `annotate`
- **Undo/redo**: Stack of previous `ChartSegment[][]` states (max 50 entries each)
- **Clipboard**: `ChartNote[]` stored for copy/cut/paste across measures
- **LN two-click state**: Tracks `lnHeadTime` during long-note insertion

### Chart Data Layer (`src/components/soundArea/noteArea/chartAdapter.ts`)

Central data manipulation module (~980 lines). Key responsibilities:

- **Validation**: Measure-level (duplicate heads, LN head/tail ordering, LN crossing other notes) and global (absolute-time duplicate heads, LN overlaps). Used before persisting and on import.
- **Time computation**: `recomputeSegmentTimes` rebuilds absolute times from cumulative measure durations; `stripChartDataTimes` removes them for storage.
- **Migration**: `migrateNoteLaneData` upgrades old schemas — converts deprecated `startTime`/`endTime` fields to boundary notes, normalizes empty segments.
- **Import/Export**: `parseImportedNoteLaneText` accepts JSON (internal NoteLane format or raw chartData array), validates, and normalizes.
- **Measure CRUD**: `insertMeasureAtTime` / `deleteMeasureAtTime` — locate the segment+measure at a given time, split/merge chunks, rebuild segments.
- **Gap filling**: `fillGapBetweenMeasures` creates intermediate empty measures between the last real measure and a target position.

### Shortcut System

`src/lib/shortcuts.ts` defines 21 shortcut actions across three groups:

| Group | Actions | Default combos |
|-------|---------|----------------|
| 时间轴 (time range) | zoomIn, zoomOut, panUp, panDown | Alt+WheelUp, Alt+WheelDown, WheelUp, WheelDown |
| 记谱输入 (note input) | 9 mode switches (browse, insertStrong, insertWeak, insertLn, select, paste, insertStart, insertEnd, annotate) | B, 1–8 |
| 记谱编辑 (note editing) | division inc/dec, measure insert/delete, copy/cut/paste/delete | ], [, Insert, Shift+Delete, Ctrl+C/X/V, Delete |

Shortcuts are user-configurable via a modal in the toolbar and persisted in app settings. Conflicts are detected with `findShortcutConflicts` and rejected on save. Both keyboard and wheel combos are supported.

Convenience helpers on `useAppSettings()`: `matchesKeyShortcut(action, event)` and `matchesShortcut(action, wheelEvent)` test whether a DOM event matches a configured combo.

### Audio Rendering

- **WaveLane**: Renders audio waveform from `AudioBuffer` using canvas.
- **SpectrumLane**: Computes FFT spectrum data in a Web Worker, renders via canvas. The worker source is **inlined via Blob URL** (`createSpectrumWorker.ts` converts the worker function to a string and creates a blob URL) — no separate worker file is fetched at runtime.
- **NoteLane**: Renders note charts on a time grid with measure graduations. Note positioning uses rational fractions (head/body/tail as `{a, b}`) mapped to absolute times via segment tempo.

### Time View System

`src/components/timeViewUtils.ts` provides the time scaling math:

- `getVisibleSpan(duration, timeMultiplier)`: Visible time window = `clamp(timeMultiplier * 2, MIN_VISIBLE_SPAN, duration)`. Minimum span is 0.05s.
- `getNextTimeMultiplierByWheel(duration, currentMultiplier, deltaY)`: Zoom by factor 10/9 (shrink) or 9/10 (expand).
- Wheel panning uses 5% of visible span per step (`WHEEL_PAN_RATIO = 0.05`).

`WorkArea` handles zoom/pan wheel events via `matchesShortcutRef` (ref-based to avoid effect re-registration). A `wheelUpdateGuardRef` prevents double-processing within the same animation frame.

### CI/CD

Two GitHub Actions workflows trigger on push to `main`:

1. **`deploy.yml`**: Builds the web export (`pnpm build`) and deploys to GitHub Pages via `actions/deploy-pages@v4`.
2. **`desktop-build.yml`**: Cross-compiles desktop builds for win32/darwin/linux x64 via matrix strategy, uploads zipped artifacts.

Both use pnpm 10, Node 22, `pnpm install --frozen-lockfile`.

### Key Conventions

- All components use `"use client"` (Next.js static export, no server components).
- CSS Modules (`*.module.css`) co-located with components. Tailwind utility classes used for layout/spacing.
- `@/` path alias maps to `src/`.
- `generateId()` (in `audioData.ts`) uses `Date.now()` + random number concatenation — not UUID-based despite the `uuid` dependency being in package.json.
- React Compiler enabled (`reactCompiler: true` in next.config.ts).
- `other/` directory contains experimental/reference code (e.g., `audioScheduler.ts`); excluded from Electron packaging and builds.
