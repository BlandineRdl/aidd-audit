export interface HarnessTreeEntry {
  readonly path: string
}

// INVARIANT: crosses no context boundary and abstracts nothing the domain knows about — both its
// implementations (a real directory here, a fixture in its own suite) are adapters, so this is not
// a port and must not be named one. `entries` lists every file under one directory, recursively,
// with paths already relative to the tree's own root; `read` returns a file's content or null when
// it cannot be read, never an empty string standing in for absence.
export interface HarnessTree {
  entries(directory: string): Promise<readonly HarnessTreeEntry[]>
  read(path: string): Promise<string | null>
}
