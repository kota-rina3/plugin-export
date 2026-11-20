<p align="center">
  <img src="icon.svg" alt="Export plugins icon" width="96" height="96">
</p>

# Export plugins

A DeepSeek Harness (DSH) plugin that adds an **Export plugins** action to the Plugins page and exports selected installed plugins as installable bundle directories.

English | [简体中文](README-CN.md)

## Features

- **Export any installed plugin** — profile-installed plugins, linked workspace
  checkouts, and the official bundles shipped with the installation.
- **Multi-select picker** — checkbox list with a filter box and
  select-all / clear.
- **Per-plugin directories** — every plugin lands in its own subdirectory named
  by its package name; scoped names keep their `@scope` level, so several
  plugins can share one target folder without overwriting each other.
- **Native folder picker** — `Browse…` opens the system directory picker;
  the default target is `~/plugin-exports`.
- **Bilingual UI** — English and Simplified Chinese.
- **No build step** — plain JavaScript on both halves.

## Requirements

- DeepSeek Harness Desktop.
- The plugin itself is a local bundle: no npm publishing, no build toolchain.

## Installation

1. Open the **Plugins** page in DSH.
2. Open the **Add plugin** menu and choose the local-directory installation.
3. Point it at this folder (`plugin-export`) and confirm.

The plugin is then listed as `@local/plugin-export`. Refresh the page once to
load its client half.

## Usage

1. Open the **Plugins** page.
2. Open the **Add plugin** menu (`+ / ▾`) and click **Export plugins**.
3. Tick the plugins you want to export — use the filter or **Select all**.
4. Choose a target folder: the default is `plugin-exports` under your home
   directory; **Browse…** opens the native picker.
5. Click **Export**.

Each plugin is written into its own subdirectory named by its package name:

```text
plugin-exports/
├─ @local/
│  ├─ account-balance/
│  │  ├─ package.json
│  │  ├─ index.js
│  │  ├─ client.js
│  │  ├─ cordis.patch.yml
│  │  ├─ locale/
│  │  └─ docs/
│  └─ plugin-export/
└─ @liustack/
   └─ modlens/
```

Unscoped packages land in a single directory (`<target>/dsh-context`).

### Reinstalling an exported plugin

An exported directory is a complete, installable bundle. To install it again:

1. If a plugin with the same package name is already installed,
   `remove_bundle` it first.
2. Run `install_bundle` against the exported subdirectory, e.g.
   `plugin-exports/@local/account-balance`.

## How it works

- **Host** (`index.js`) — provides the Cordis service `pluginExport` through
  `ctx.effect` → `ctx.provide`. The service carries runtime Typert Remote
  markers (a hidden prototype descriptor plus the `typertRemote` binding that
  the `@Remote` decorator and `TypertRemoteService` base would generate), so the
  Typert Gateway claims the `pluginExport/listPlugins` and
  `pluginExport/exportPlugin` endpoints without compiler-generated artifacts.
- **Client** (`client.js`) — registers the menu row in `plugins.add.actions`
  and the dialog host in `shell.overlay`. It calls the two endpoints as package
  RPCs over the `/api` connection (`ctx.get('connection').rpc.call`), because
  mounting a Remote namespace with `remote.$mount` requires compiler-generated
  strict input codecs.
- **Discovery** — the Host scans, in priority order: the profile
  `node_modules` (from `DSH_PROFILE_DIR`, the `DSH_HOME`/`DSH_PROFILE` pair, or
  every `~/.dsh/profiles/*/node_modules`), the directories derived from the
  module's own location (linked profile install or workspace checkout), and the
  installation's package tree. This keeps discovery working even when the host
  process does not receive the `DSH_*` environment variables.
- **Export layout** — each plugin's files are written into
  `<target>/<package-name path>`. The `package.json` is rewritten to keep its
  identity and DSH wiring (`name`, `dsh.bundle`, `dsh.client`, `exports`,
  `files`) while dropping dependencies and scripts, so the result installs as a
  local bundle. Runtime files copied: `index.js`, `client.js`,
  `cordis.patch.yml`, `locale/*.json`, `docs/**`, `icon.svg`, and `README.md`
  when present.

## Limitations

- Only the files present in the installed package are exported; the plugin does
  not run a build step.
- Package-manager metadata (dependencies, lockfiles, scripts) is intentionally
  left out of the exported `package.json`.
- Verified on Windows Desktop; the implementation uses Node path APIs and should
  work on macOS and Linux, but that has not been verified.

## Development

| File | Role |
| --- | --- |
| `index.js` | Host half — service, scan roots, file export |
| `client.js` | Client half — menu row, dialog, RPC bridge |
| `locale/en.json`, `locale/zh.json` | Plugin-manager metadata |
| `docs/DETAIL.md` | In-app detail page document |
| `icon.svg` | Bundle icon |

Syntax check both halves with `node --check index.js client.js` (or any
equivalent Node runtime).

## Support

If this plugin saves you time, you can buy the author a cup of sweet black tea 🍵

![Reward QR code](BlackTea.png)

## License

MIT License
