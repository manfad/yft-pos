# Yun Fook Trading — POS (monorepo)

Offline-first desktop till. Vue 3 SPA built **wrapper-agnostic** so Tauri vs
Electron can be chosen at packaging time, not now.

## Layout

```
mono/
├── packages/
│   ├── core/   @yf/core — pure-TS domain. Types, pricing (incl. quantity
│   │           tiers), order + stats logic, and the PosRepo interface.
│   │           No SQL, no I/O → fully unit-testable.
│   └── data/   @yf/data — PosRepo implementations. sql.js (browser dev) now;
│               tauri-plugin-sql / node:sqlite added when a wrapper is picked.
└── apps/
    └── pos/    @yf/pos — Vue 3 + Vite + Pinia + vue-router + UnoCSS SPA.
```

### Why this shape

The business rules (cents/milli-units, server-authoritative pricing, quantity
discounts, order snapshots) live in `@yf/core` as pure functions over plain
data. `@yf/data` only does raw CRUD/queries behind the `PosRepo` interface, so
swapping the storage backend is a one-file change — that's what keeps the
Tauri-vs-Electron decision deferred.

## Develop

```bash
pnpm install
pnpm dev         # runs the Vue app at http://localhost:5173 (sql.js in browser)
pnpm test        # 25 unit/integration tests (pricing tiers, orders, stats, repo)
pnpm typecheck   # strict TS across all packages
pnpm build       # type-checked production build of the SPA
```

### Update and build on Windows over SSH

From the repository folder, run in Command Prompt:

```bat
build-windows.cmd
```

In Git Bash use `./build-windows.cmd`; in PowerShell use
`.\build-windows.cmd`. If `pnpm` is not on `PATH`, the script automatically
runs the repository's pinned pnpm version through Corepack.

The script pulls with `--ff-only`, installs the locked dependencies, runs the
tests and type checks, then creates the Windows installer and portable app in
`apps\pos\release`.

Data persists to IndexedDB; on a fresh DB the catalogue + demo orders are
seeded so the Sales report has content. Admin → **Reset demo data** wipes it.

## Status

- ✅ `@yf/core` — money/qty, tier pricing, order building, stats, schema (+ tests)
- ✅ `@yf/data` — `SqlPosRepo` over a `SqlDriver`; sql.js driver + IndexedDB
- ✅ `@yf/pos` — Till (Classic + Big Buttons), Sales report, Admin CRUD + tier editor
- ⬜ desktop wrapper — deferred (see below)

The fish-style **quantity discount** is wired end to end: edit tiers in Admin
(e.g. Talapia ships with “≥ 30 kg → RM15”), and the till applies the break live,
snapshotting the effective price onto each order line.

## Wrapping for offline desktop (next)

Pick Tauri or Electron and add an app under `apps/`. The only code that changes
is the data wiring: implement a `SqlDriver` (`packages/data/src/driver.ts`) over
`tauri-plugin-sql` or `node:sqlite`, then point `apps/pos/src/db.ts` at it
instead of sql.js. The repo, stores, and UI are untouched. `vite` `base: "./"`
is already set for `file://` loading.

> The original `../backend/` (node:http + node:sqlite + admin.html) is kept as
> the reference spec and can be retired once the desktop wrapper lands.
