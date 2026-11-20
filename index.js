/**
 * @local/plugin-export — Host half.
 *
 * Provides the export capability as the Cordis service `pluginExport` carrying
 * runtime Typert Remote markers, so the browser half calls `listPlugins` and
 * `exportPlugin` through the Typert Gateway without generated artifacts:
 *
 * - the hidden prototype descriptor stands in for the `@Remote` decorator;
 * - the `typertRemote` binding stands in for the `TypertRemoteService` base;
 * - `ctx.provide` registers the service, which puts it in the gateway's
 *   endpoint-claim scan (`Service` keys of type "service").
 *
 * The service methods are plain closures (never `this`) whose results are
 * JSON-safe, because every Remote result crosses the wire as JSON.
 */

import { readdir, readFile, stat, mkdir, writeFile } from 'node:fs/promises'
import { join, dirname, basename } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'

/** Hidden prototype property the Typert Gateway reads Remote markers from. */
const REMOTE_METHOD_DESCRIPTOR = '@deepseek-ai/dsh-typert-protocol/remote-methods'

/** Files always copied for an exported plugin. */
const EXPORT_FILES = ['package.json', 'cordis.patch.yml', 'index.js', 'client.js', 'icon.svg', 'README.md', 'README-CN.md']

/** Directories copied wholesale when present. */
const COPY_DIRS = ['locale', 'docs']

/**
 * This module's own directory, used as an environment-independent anchor.
 * A profile installation links to the checkout, so either the profile package
 * directory or the workspace checkout is reported; both are usable anchors.
 * @returns absolute directory, or undefined when the URL cannot be converted.
 */
function moduleDir() {
  try {
    return dirname(fileURLToPath(import.meta.url))
  } catch {
    return undefined
  }
}

/**
 * Directories scanned for installed plugins, most specific first. The process
 * environment is not authoritative here: a Desktop host may omit the DSH_*
 * variables that tool subprocesses receive, so the profile roots are also
 * derived from the home directory and from this module's own location.
 * @returns absolute anchor directories, de-duplicated in priority order.
 */
async function pluginRoots() {
  const roots = []
  const add = (dir) => {
    if (typeof dir === 'string' && dir.length > 0 && !roots.includes(dir)) roots.push(dir)
  }

  // 1. Explicit profile variables, when the launcher provides them.
  if (process.env.DSH_PROFILE_DIR) add(join(process.env.DSH_PROFILE_DIR, 'node_modules'))
  if (process.env.DSH_HOME && process.env.DSH_PROFILE) {
    add(join(process.env.DSH_HOME, 'profiles', process.env.DSH_PROFILE, 'node_modules'))
  }

  // 2. Every profile's node_modules under the DSH home (HOME is always known).
  const dshHome = process.env.DSH_HOME ?? join(homedir(), '.dsh')
  try {
    for (const entry of await readdir(join(dshHome, 'profiles'), { withFileTypes: true })) {
      if (entry.isDirectory()) add(join(dshHome, 'profiles', entry.name, 'node_modules'))
    }
  } catch {}

  // 3. Anchors derived from this module's location. A linked profile install
  // reports <profile>/node_modules/@scope/<pkg>, so the scope directory and
  // node_modules are parents; a checkout reports <workspace>/<pkg>, so the
  // workspace root is the parent.
  const here = moduleDir()
  if (here) {
    add(join(here, '..'))
    add(join(here, '..', '..'))
  }

  // 4. The installation's own package tree (official bundles).
  if (process.env.DSH_INSTALL_DIR) add(join(process.env.DSH_INSTALL_DIR, '..', '..'))
  try {
    add(join(dirname(process.execPath), 'resources', 'app.asar', 'dsh', 'node_modules'))
  } catch {}

  return roots
}

/**
 * List the child directories of one root, following symlinks so directory
 * installations (linked checkouts) are covered too.
 * @param root - absolute directory; missing or unreadable roots yield [].
 */
async function listChildDirs(root) {
  let entries
  try {
    entries = await readdir(root, { withFileTypes: true })
  } catch {
    return []
  }
  const dirs = []
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    const full = join(root, entry.name)
    try {
      // `stat` follows symlinks; plain package directories pass unchanged.
      if ((await stat(full)).isDirectory()) dirs.push(full)
    } catch {}
  }
  return dirs
}

/**
 * Read the plugin facts the export picker needs from one candidate directory.
 * @param packageDir - absolute package directory.
 * @returns { name, version, description, title } or null when not a plugin.
 */
async function readPluginInfo(packageDir) {
  let pkg
  try {
    pkg = JSON.parse(await readFile(join(packageDir, 'package.json'), 'utf8'))
  } catch {
    return null
  }
  if (pkg === null || typeof pkg !== 'object') return null
  if (typeof pkg.name !== 'string' || pkg.name.length === 0) return null
  if (!pkg.dsh || typeof pkg.dsh !== 'object' || !pkg.dsh.bundle) return null
  let title = ''
  try {
    const locale = JSON.parse(await readFile(join(packageDir, 'locale', 'en.json'), 'utf8'))
    if (locale && typeof locale.meta?.title === 'string') title = locale.meta.title
  } catch {}
  return {
    name: pkg.name,
    version: typeof pkg.version === 'string' ? pkg.version : '0.0.0',
    description: typeof pkg.description === 'string' ? pkg.description : '',
    title,
  }
}

/**
 * Read one directory recursively into relative-path → Buffer contents.
 * @param dir - absolute directory; missing or unreadable trees yield nothing.
 * @returns a Map of relative paths to file contents.
 */
async function readDirectoryFiles(dir) {
  const files = new Map()
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return files
  }
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      for (const [relative, content] of await readDirectoryFiles(full)) {
        files.set(join(entry.name, relative), content)
      }
    } else if (entry.isFile()) {
      try {
        files.set(entry.name, await readFile(full))
      } catch {}
    }
  }
  return files
}

/**
 * Gather every file that makes up an exported plugin bundle.
 * @param packageDir - absolute package directory.
 * @returns a Map of relative paths to file contents.
 */
async function gatherPluginFiles(packageDir) {
  const files = new Map()
  for (const name of EXPORT_FILES) {
    try {
      files.set(name, await readFile(join(packageDir, name)))
    } catch {}
  }
  for (const dirName of COPY_DIRS) {
    for (const [relative, content] of await readDirectoryFiles(join(packageDir, dirName))) {
      files.set(join(dirName, relative), content)
    }
  }
  return files
}

/**
 * Build the exported bundle's package.json: identity, metadata, and DSH wiring
 * are preserved; dependency machinery (`dependencies`, `scripts`, lockfiles)
 * is left out so the export installs cleanly as a local bundle.
 * @param original - the installed plugin's parsed package.json.
 * @returns the rewritten package.json text.
 */
function buildExportPackageJson(original) {
  const pkg = {
    name: original.name,
    version: typeof original.version === 'string' ? original.version : '1.0.0',
    private: true,
    type: 'module',
  }
  if (typeof original.description === 'string' && original.description.length > 0) {
    pkg.description = original.description
  }
  if (original.exports && typeof original.exports === 'object') pkg.exports = original.exports
  if (Array.isArray(original.files)) pkg.files = original.files
  if (original.dsh && typeof original.dsh === 'object') pkg.dsh = original.dsh
  return JSON.stringify(pkg, null, 2) + '\n'
}

/**
 * Build the `pluginExport` service: a dedicated prototype keeps the Remote
 * markers off `Object.prototype`, and the frozen `typertRemote` binding names
 * the Cordis service key and wire namespace the gateway dispatches through.
 * @returns the service object ready for `ctx.provide('pluginExport', …)`.
 */
function createPluginExportService() {
  const proto = {}

  proto.listPlugins = async function listPlugins() {
    const seen = new Set()
    const plugins = []
    const collect = async (packageDir) => {
      const info = await readPluginInfo(packageDir)
      if (info === null || seen.has(info.name)) return
      seen.add(info.name)
      plugins.push(info)
    }
    for (const root of await pluginRoots()) {
      for (const dir of await listChildDirs(root)) {
        // Scoped packages (e.g. @local/…) keep one more directory level.
        if (basename(dir).startsWith('@')) {
          for (const scoped of await listChildDirs(dir)) await collect(scoped)
        } else {
          await collect(dir)
        }
      }
    }
    return plugins
  }

  proto.exportPlugin = async function exportPlugin(pluginName, targetDir) {
    if (typeof pluginName !== 'string' || pluginName.length === 0) {
      throw new TypeError('pluginName must be a non-empty string')
    }
    if (typeof targetDir !== 'string' || targetDir.length === 0) {
      throw new TypeError('targetDir must be a non-empty string')
    }
    // Each plugin owns a subtree named by its package name, so any number of
    // exports can share one parent folder without overwriting each other.
    const segments = pluginName.split('/')
    if (segments.some(segment => segment.length === 0 || segment === '.' || segment === '..' || /[\\:]/u.test(segment))) {
      throw new TypeError(`pluginName is not a safe package name: ${pluginName}`)
    }

    const sourceDir = await resolvePluginDir(pluginName)
    if (sourceDir === null) throw new Error(`Plugin not found: ${pluginName}`)

    const files = await gatherPluginFiles(sourceDir)
    if (!files.has('package.json')) throw new Error(`Plugin has no package.json: ${pluginName}`)
    const original = JSON.parse(await readFile(join(sourceDir, 'package.json'), 'utf8'))
    files.set('package.json', Buffer.from(buildExportPackageJson(original), 'utf8'))

    const destination = join(targetDir, ...segments)
    await mkdir(destination, { recursive: true })
    for (const [relative, content] of files) {
      const filePath = join(destination, relative)
      await mkdir(dirname(filePath), { recursive: true })
      await writeFile(filePath, content)
    }
    return { plugin: pluginName, target: destination, files: [...files.keys()] }
  }

  const service = Object.create(proto)

  Object.defineProperty(proto, REMOTE_METHOD_DESCRIPTOR, {
    configurable: true,
    value: Object.freeze({
      version: 1,
      methods: Object.freeze([
        Object.freeze({ method: 'listPlugins', invocation: Object.freeze({ kind: 'direct' }) }),
        Object.freeze({ method: 'exportPlugin', invocation: Object.freeze({ kind: 'direct' }) }),
      ]),
    }),
  })
  Object.defineProperty(service, 'typertRemote', {
    value: Object.freeze({ service, serviceKey: 'pluginExport', namespace: 'pluginExport' }),
  })

  return service
}

/**
 * Resolve one installed plugin's package directory by its exact package name.
 * @param pluginName - exact package name, e.g. `@local/account-balance`.
 * @returns the absolute package directory, or null when not found.
 */
async function resolvePluginDir(pluginName) {
  for (const root of await pluginRoots()) {
    const candidates = []
    for (const dir of await listChildDirs(root)) {
      if (basename(dir).startsWith('@')) candidates.push(...await listChildDirs(dir))
      else candidates.push(dir)
    }
    for (const candidate of candidates) {
      let pkg
      try {
        pkg = JSON.parse(await readFile(join(candidate, 'package.json'), 'utf8'))
      } catch {
        continue
      }
      if (pkg && pkg.name === pluginName) return candidate
    }
  }
  return null
}

/**
 * Provide the export service for the plugin's lifetime.
 * @param ctx - Host plugin context; `effect` and `provide` are core verbs.
 */
export function apply(ctx) {
  ctx.effect(() => ctx.provide('pluginExport', createPluginExportService()), 'plugin-export: remote service')
}
