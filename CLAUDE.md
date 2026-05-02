# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development

```bash
pnpm install        # Install dependencies
pnpm dev            # Next.js dev server (web build, basePath=/rhythm_annotating)
pnpm build          # Next.js static export → out/
pnpm lint           # ESLint
```

### Desktop (Electron)

```bash
pnpm desktop:start                                                  # Build desktop renderer + launch Electron locally
pnpm desktop:make:win:x64                                           # Package for a specific platform (also win:arm64, mac:x64, mac:arm64, linux:x64, linux:arm64)
pnpm build:desktop:renderer                                         # Only build the Next.js desktop export → dist-desktop-renderer/
```

Desktop build sets `BUILD_TARGET=desktop` env, which makes Next.js export with an empty `basePath` (no `/rhythm_annotating` prefix). The Electron main process serves this via a custom `app://` protocol with path traversal protection.

## Architecture

This is a **local-first rhythm annotation editor** — a Next.js 16 static-export SPA (no SSR), also packaged as an Electron desktop app.

### Build Targets

| Target | `basePath` | Output | Runtime |
|--------|---|-----|-----|
| Web (`pnpm build`) | `/rhythm_annotating` | `out/` | GitHub Pages / static hosting |
| Desktop (`BUILD_TARGET=desktop`) | empty | `dist-desktop-renderer/` | Electron (`electron/main.cjs`) |

Electron loads the desktop renderer via a custom `app://` protocol handler that resolves files from `dist-desktop-renderer/` with strict path traversal checks. The preload script (`electron/preload.cjs`) exposes `window.desktopRuntime` via `contextBridge` (isElectron, platform, arch, versions).

### State & Persistence

- **Settings** (shortcuts, time view, spectrum view): React context (`AppSettingsContext`), persisted to `localStorage` under key `explicitize.app-settings`. Hydrated synchronously on mount.
- **Project data** (audio lanes, note charts, play state): React context (`AudioDataCtx`) + component state in `WorkArea`. Auto-saved to **IndexedDB** (database `explicitize-editor`) via a 350ms debounce whenever project/audio/slice state changes.
- **Slice registry** (`src/lib/persistence/sliceRegistry.ts`): Extensible per-feature persistence. Components register a slice (key + getState/applyState + serialize/deserialize), and those slices are collected into the project snapshot alongside the main project state.
- **IndexedDB schema**: Two object stores — `audios` (keyed by id, stores audio blobs as `PersistedAudioRecord`) and `snapshots` (keyed by string key, generally `"current"`).

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
- **`NoteLaneData`** (`src/components/soundArea/noteArea/chartTypes.ts`): Note chart data — array of `ChartSegment` (time + tempo + measures), each measure containing `ChartNote[]`. Notes have a type (strong/weak/LN), optional head/body/tail fractions, and a unique id.
- **`project`** (`src/interface/project.ts`): Top-level state — currentTime, timeMultiplier, isPlaying, playSpeed, soundLaneStates[].

### Shortcut System

`src/lib/shortcuts.ts` defines 12 shortcut actions across two groups (time range: zoom/pan; note input: mode switching, division). Defaults include both keyboard (`1`–`5`, `[`, `]`) and wheel combos (`Alt+WheelUp` for zoom). Shortcuts are user-configurable via a modal in the toolbar and persisted in app settings. Conflicts are detected and rejected on save.

Convenience helpers on the context: `matchesKeyShortcut(action, event)` and `matchesShortcut(action, wheelEvent)` directly test whether a DOM event matches a configured combo.

### Audio Rendering

- **WaveLane**: Renders audio waveform from `AudioBuffer` using canvas.
- **SpectrumLane**: Computes FFT spectrum data in a Web Worker (`spectrumWorker.ts`), renders via canvas. Worker is initialized via `createSpectrumWorker.ts` (WASM-based approach).
- **NoteLane**: Renders note charts on a time grid with measure graduations.

### Key Conventions

- All components use `"use client"` (Next.js static export, no server components).
- CSS Modules (`*.module.css`) co-located with components. Tailwind utility classes used for layout/spacing.
- `@/` path alias maps to `src/`.
- `generateId()` (in `audioData.ts`) uses `Date.now()` + random number concatenation — not UUID-based despite the `uuid` dependency being in package.json.
- React Compiler enabled (`reactCompiler: true` in next.config.ts).
- `.npmrc` sets `auto-install-peers=false` for pnpm strictness.
