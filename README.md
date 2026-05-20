# Explicitize - A rhythm annotating tool

A local-first rhythm annotation editor built with Next.js. Features:

- Audio waveform & spectrum preview
- NoteLane chart editing
- Local auto-save (IndexedDB)
- Internal JSON import/export
- Customizable keyboard & wheel shortcuts
- Static web export (GitHub Pages)
- Electron desktop packaging (Windows / macOS / Linux)

[GitHub Repository](https://github.com/OhnkytaBlabdey/rhythm_annotating)

## Development

```bash
pnpm install
pnpm dev
```

The default web build includes a `basePath` for GitHub Pages deployment.

## Web Build

```bash
pnpm build
```

Output directory: `out/`

## Desktop Build

Desktop builds use a two-stage process:

1. Next.js static export with desktop-specific config (`BUILD_TARGET=desktop`)
2. Output goes to `dist-desktop-renderer/`
3. Electron loads the local `index.html`
4. Electron Forge packages the app

### Run desktop locally

```bash
pnpm desktop:start
```

### Build desktop renderer only

```bash
pnpm build:desktop:renderer
```

### Package for current platform

```bash
pnpm desktop:package
pnpm desktop:make
```

### Platform-specific targets

Six zip-target scripts are available:

```bash
pnpm desktop:make:win:x64
pnpm desktop:make:win:arm64
pnpm desktop:make:mac:x64
pnpm desktop:make:mac:arm64
pnpm desktop:make:linux:x64
pnpm desktop:make:linux:arm64
```

Notes:

- Signing and notarization are explicitly skipped.
- All scripts use `@electron-forge/maker-zip` for consistent cross-platform packaging.
- Success depends on the host environment and Electron binary availability for the target platform.

## Shortcuts

Open the shortcuts modal from the toolbar to bind keys for these actions:

- Time range zoom and pan
- Browse, strong beat, weak beat, long note, select, and paste modes
- Division increment/decrement
- Measure insert/delete
- Copy, cut, paste, delete notes

Empty bindings are allowed. Conflicting shortcuts are detected and rejected on save.

## Text Import

Only internal JSON format is supported; importing overwrites the current NoteLane.

Accepted input formats:

- Exported `NoteLaneData`
- Internal export objects with a `lane` field
- Raw `chartData` arrays

Import performs:

- JSON parse error handling
- Basic field validation
- Chart structure validation
- Pre-render re-validation

## Notes

- Desktop builds require `node-linker=hoisted` in `.npmrc`
- Electron binaries are installed via `pnpm rebuild electron`
