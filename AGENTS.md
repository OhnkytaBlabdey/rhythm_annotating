# AGENTS.md

## Commands
- Use pnpm; `.npmrc` requires `node-linker=hoisted` for Electron module resolution. Do not switch package managers or linker mode.
- CI uses Node 22 and pnpm 10 with `pnpm install --frozen-lockfile`.
- `pnpm dev` runs the web Next dev server with `basePath=/rhythm_annotating`.
- `pnpm build` / `pnpm build:web` creates the static web export in ignored `out/`.
- `pnpm lint` is the only configured fast check; there is no Jest/Vitest/Playwright or `typecheck` script.
- `pnpm build:desktop:renderer` sets `BUILD_TARGET=desktop`, runs the Next export without a basePath, then copies `out/` to ignored `dist-desktop-renderer/`.
- `pnpm desktop:start` rebuilds the desktop renderer before launching Electron; desktop package/make scripts also rebuild it first.

## Build Targets
- This is a single-package Next 16 static-export SPA, also packaged by Electron; `pnpm-workspace.yaml` is pnpm config, not a monorepo package map.
- Web builds use `basePath=/rhythm_annotating` and expose it as `NEXT_PUBLIC_BASE_PATH`; desktop builds use no basePath. Asset and route changes must work in both targets.
- Static export depends on `images.unoptimized: true` in `next.config.ts`.
- Electron loads `dist-desktop-renderer/` via the custom `app://-/index.html` protocol in `electron/main.cjs`; preload only exposes `window.desktopRuntime`.

## App Wiring
- `src/app/page.tsx` renders `WorkArea`; `src/app/layout.tsx` wraps the app in `Providers`, currently only `AppSettingsProvider`.
- `WorkArea` owns project state and audio file state, then provides audio through `AudioDataCtx`; project state is not in React context.
- App settings persist in localStorage key `explicitize.app-settings` with schema version 2.

## Persistence And Chart Data
- IndexedDB database `explicitize-editor` v1 has `audios` and `snapshots`; autosave runs 350ms after project/audio/slice changes.
- Persisted slices are registered through `src/lib/persistence/sliceRegistry.ts`; current slices are `timeView` and `spectrumView`.
- `ChartSegment.time` is derived data: persistence/export strips it and hydration/import recomputes it. Do not make saved data depend on stored segment times.
- Note chart mutations, validation, migration, import parsing, and measure CRUD belong in `src/components/soundArea/noteArea/chartAdapter.ts`.
- Boundary markers are special notes (`type` -1 start, -2 end), not separate `startTime`/`endTime` fields after migration.
- Project export files use a custom EXPR/EXPC binary format compressed with `lzma1` despite the `.7z` download extension.

## Repo Quirks
- Spectrum workers are inlined from `spectrumWorkerMain.toString()`; keep worker runtime logic self-contained inside that function.
- `other/`, `.next/`, `out/`, and `dist-desktop-renderer/` are not source of truth for app changes.
- Electron packaging excludes `src/`, `public/`, `node_modules/`, `other/`, and `test/` from ASAR; only `dist-desktop-renderer/` is included as an extra resource.
- Icon assets under `public/assets/icons/` are tracked through Git LFS.
- Formatting uses 4-space indentation via `.prettierrc`; `@/*` maps to `src/*`.
