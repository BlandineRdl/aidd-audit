import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import type { LoadingTier } from '../models/loading-tier.model.js'
import type { ReadingScope } from '../models/reading-scope.model.js'
import type {
  HarnessSourceFile,
  HarnessSourcePort,
  HarnessSourceReading,
  HarnessSourceUnreadEntry,
} from '../ports/harness-source.port.js'
import { followImports } from './claude/context-imports.js'
import { splitDeclaration } from './claude/declaration-front-matter.js'
import { directoryTree } from './claude/directory-tree.js'
import type { HarnessTree } from './claude/harness-tree.js'
import { tierOfRule } from './claude/rule-tier.js'

// INVARIANT: the tool accepts a context file at either location without ranking one over the
// other, so a deterministic order has to be chosen somewhere when a subject somehow carries both.
// The project root wins: it is the location every reference profile and this repository itself
// use, and picking it keeps a subject that only ever has one candidate unaffected either way.
const CONTEXT_FILE_CANDIDATES = ['CLAUDE.md', '.claude/CLAUDE.md'] as const
const LOCAL_CONTEXT_FILE = 'CLAUDE.local.md'
const RULES_DIRECTORY = 'rules'
const DECLARATION_DIRECTORIES = ['skills', 'agents', 'commands'] as const

// SAFETY: a subject holds these under `.claude/`, while the machine scope's tree is already rooted
// at the configuration directory itself and holds them at its top level. Prefixing unconditionally
// sent the machine read looking for `~/.claude/.claude/rules`, which cannot exist, so a personal
// rule, skill, agent or command was never counted — silently, and always understating the tier the
// spec added the machine scope to measure.
const SUBJECT_PREFIX = '.claude/'
const MACHINE_IMPORT_PREFIX = '~/.claude/'

// INVARIANT: the synthetic suffix a declaration's body is published under, so a skill's
// description and its body can both be measured as their own entry without colliding on one path.
const BODY_SUFFIX = '::body'

interface ContextFile {
  readonly path: string
  readonly content: string
}

// SAFETY: dedupe on the resolved absolute path, never on the published one. The machine
// configuration directory is also reached by the ancestor walk, which spells the same file
// differently, so a set keyed on the published path counted those files twice and doubled the
// machine tier's totals.
function push(
  files: HarnessSourceFile[],
  seen: Set<string>,
  root: string,
  path: string,
  content: string,
  tier: LoadingTier,
  scope: ReadingScope,
  publishAt: (path: string) => string,
): void {
  const key = resolve(root, path)
  if (seen.has(key)) return
  seen.add(key)
  const published = publishAt(path)
  files.push({
    path: published,
    byteSize: Buffer.byteLength(content, 'utf8'),
    content,
    tier,
    scope,
  })
}

async function findContextFile(tree: HarnessTree): Promise<ContextFile | null> {
  for (const candidate of CONTEXT_FILE_CANDIDATES) {
    const content = await tree.read(candidate)
    if (content !== null) return { path: candidate, content }
  }
  return null
}

// LIMITATION: a named but missing import contributes nothing — it is absent from the always-
// loaded tier rather than published as a file measured at zero, which is what tells a gap in
// evidence apart from a fact about the file.
async function forEachImportOf(
  tree: HarnessTree,
  machineTree: HarnessTree,
  entry: ContextFile,
  publish: (path: string, content: string) => void,
  publishMachineImport: (path: string, content: string) => void,
  markUnread: (path: string) => void,
): Promise<void> {
  const imports = await followImports(entry.path, entry.content, (path) =>
    path.startsWith(MACHINE_IMPORT_PREFIX)
      ? machineTree.read(path.slice(MACHINE_IMPORT_PREFIX.length))
      : tree.read(path),
  )
  for (const imported of imports) {
    if (imported.content === null) {
      markUnread(imported.path)
    } else if (imported.path.startsWith(MACHINE_IMPORT_PREFIX)) {
      publishMachineImport(imported.path, imported.content)
    } else {
      publish(imported.path, imported.content)
    }
  }
}

// INVARIANT: the context file, `CLAUDE.local.md` beside it, and every file either pulls in
// transitively, are all ALWAYS_LOADED — the tool reads all of it at every session opening.
async function readContextFiles(
  tree: HarnessTree,
  files: HarnessSourceFile[],
  unread: HarnessSourceUnreadEntry[],
  seen: Set<string>,
  scope: ReadingScope,
  root: string,
  machineRoot: string,
  machineTree: HarnessTree,
  publishAt: (path: string) => string = (path) => path,
): Promise<void> {
  const main = await findContextFile(tree)
  if (main === null) return

  const publish = (path: string, content: string): void =>
    push(files, seen, root, path, content, 'ALWAYS_LOADED', scope, publishAt)
  const publishMachineImport = (path: string, content: string): void => {
    const localPath = path.slice(MACHINE_IMPORT_PREFIX.length)
    push(
      files,
      seen,
      machineRoot,
      localPath,
      content,
      'ALWAYS_LOADED',
      'MACHINE',
      (publishedPath) => join(machineRoot, publishedPath),
    )
  }
  const markUnread = (path: string): void => {
    const machineImport = path.startsWith(MACHINE_IMPORT_PREFIX)
    unread.push({
      path: machineImport
        ? join(machineRoot, path.slice(MACHINE_IMPORT_PREFIX.length))
        : publishAt(path),
      scope: machineImport ? 'MACHINE' : scope,
      reason: 'MISSING_IMPORT',
    })
  }

  publish(main.path, main.content)
  await forEachImportOf(tree, machineTree, main, publish, publishMachineImport, markUnread)

  const localDirectory = main.path.includes('/')
    ? main.path.slice(0, main.path.lastIndexOf('/'))
    : ''
  const localPath =
    localDirectory === '' ? LOCAL_CONTEXT_FILE : `${localDirectory}/${LOCAL_CONTEXT_FILE}`
  const local = await tree.read(localPath)
  if (local === null) return

  const localEntry: ContextFile = { path: localPath, content: local }
  publish(localPath, local)
  await forEachImportOf(tree, machineTree, localEntry, publish, publishMachineImport, markUnread)
}

// INVARIANT: a rule with no frontmatter, or frontmatter carrying no `paths`, is ALWAYS_LOADED; a
// rule declaring `paths` is CONDITIONALLY_LOADED. A rule whose frontmatter could not be decided is
// published in neither tier — unread, not guessed.
async function readRules(
  tree: HarnessTree,
  files: HarnessSourceFile[],
  unread: HarnessSourceUnreadEntry[],
  seen: Set<string>,
  scope: ReadingScope,
  root: string,
  publishAt: (path: string) => string,
  prefix: string,
): Promise<void> {
  for (const entry of await tree.entries(`${prefix}${RULES_DIRECTORY}`)) {
    const content = await tree.read(entry.path)
    if (content === null) continue

    const reading = tierOfRule(content)
    if (!reading.decided) {
      unread.push({ path: publishAt(entry.path), scope, reason: reading.reason })
      continue
    }

    push(files, seen, root, entry.path, content, reading.tier, scope, publishAt)
  }
}

// INVARIANT: a skill, an agent and a command each publish two entries — their description in the
// always-loaded tier, their body in the conditional one — following the tool's own documented
// split between what is present from the first turn and what loads only once invoked. A
// declaration whose frontmatter carries no readable description contributes nothing: there is no
// summary to have loaded, and fabricating one would publish a fact never observed.
async function readDeclarations(
  tree: HarnessTree,
  directory: string,
  files: HarnessSourceFile[],
  unread: HarnessSourceUnreadEntry[],
  seen: Set<string>,
  scope: ReadingScope,
  root: string,
  publishAt: (path: string) => string,
): Promise<void> {
  for (const entry of await tree.entries(directory)) {
    if (!entry.path.endsWith('.md')) continue
    const content = await tree.read(entry.path)
    if (content === null) continue

    const declaration = splitDeclaration(content)
    if (!declaration.decided) {
      unread.push({ path: publishAt(entry.path), scope, reason: declaration.reason })
      continue
    }

    push(files, seen, root, entry.path, declaration.description, 'ALWAYS_LOADED', scope, publishAt)
    const bodyPath = `${entry.path}${BODY_SUFFIX}`
    push(files, seen, root, bodyPath, declaration.body, 'CONDITIONALLY_LOADED', scope, publishAt)
  }
}

async function readOneScope(
  tree: HarnessTree,
  scope: ReadingScope,
  files: HarnessSourceFile[],
  unread: HarnessSourceUnreadEntry[],
  seen: Set<string>,
  root: string,
  publishAt: (path: string) => string,
  prefix: string,
  machineRoot: string,
  machineTree: HarnessTree,
): Promise<void> {
  await readContextFiles(
    tree,
    files,
    unread,
    seen,
    scope,
    root,
    machineRoot,
    machineTree,
    publishAt,
  )
  await readRules(tree, files, unread, seen, scope, root, publishAt, prefix)
  for (const directory of DECLARATION_DIRECTORIES) {
    await readDeclarations(
      tree,
      `${prefix}${directory}`,
      files,
      unread,
      seen,
      scope,
      root,
      publishAt,
    )
  }
}

// INVARIANT: MACHINE scope only — walking up from the subject's own directory, never from the
// subject itself. Following this same walk under SUBJECT scope would make the published figure
// depend on where the repository happens to sit on disk, which contradicts the reproducibility
// that reading claims: the tool's own ancestor walk carries no documented ceiling, a repository
// moved to a different path already answers differently there, and that is exactly the
// reproduces-only-against-an-unchanged-machine claim this walk is confined to instead.
async function readAncestors(
  subjectPath: string,
  signal: AbortSignal,
  files: HarnessSourceFile[],
  unread: HarnessSourceUnreadEntry[],
  seen: Set<string>,
  machineRoot: string,
  machineTree: HarnessTree,
): Promise<void> {
  let directory = resolve(subjectPath)

  for (;;) {
    const parent = dirname(directory)
    if (parent === directory) return
    directory = parent

    const tree = directoryTree(directory, signal)
    await readContextFiles(
      tree,
      files,
      unread,
      seen,
      'MACHINE',
      directory,
      machineRoot,
      machineTree,
      (path) => join(directory, path),
    )
  }
}

export class ClaudeHarnessAdapter implements HarnessSourcePort {
  readonly tool = 'claude'

  constructor(private readonly machineConfigDirectory: string = join(homedir(), '.claude')) {}

  async read(subjectPath: string, signal: AbortSignal): Promise<HarnessSourceReading> {
    const files: HarnessSourceFile[] = []
    const unread: HarnessSourceUnreadEntry[] = []
    const seen = new Set<string>()
    const machine = this.machineConfigDirectory
    const machineTree = directoryTree(machine, signal)

    await readOneScope(
      directoryTree(subjectPath, signal),
      'SUBJECT',
      files,
      unread,
      seen,
      subjectPath,
      (path) => path,
      SUBJECT_PREFIX,
      machine,
      machineTree,
    )
    await readOneScope(
      machineTree,
      'MACHINE',
      files,
      unread,
      seen,
      machine,
      (path) => join(machine, path),
      '',
      machine,
      machineTree,
    )
    await readAncestors(subjectPath, signal, files, unread, seen, machine, machineTree)

    return { files, unread }
  }
}
