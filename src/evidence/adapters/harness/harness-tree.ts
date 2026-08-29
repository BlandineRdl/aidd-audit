export interface HarnessTreeEntry {
  readonly path: string
  readonly regularFile: boolean
  // Whether the recorded tree marks it executable; null when the tree records no mode.
  readonly executable: boolean | null
}

export interface HarnessTree {
  entries(): Promise<readonly HarnessTreeEntry[]>
  // null is "could not be read", never "read and found empty".
  probe(path: string, bytes: number): Promise<string | null>
  read(path: string): Promise<string | null>
}
