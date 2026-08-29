import YAML from 'yaml'

// Loosely typed on purpose, so a test can build a malformed document without casting.
interface TestRequirement {
  axis: string
  min?: number | string
  includes?: string[]
}

interface TestLevel {
  id: string
  rank: number | string
  label: string
  requirements: TestRequirement[]
}

interface TestAxis {
  id: string
  label: string
  scale: string
}

interface TestScale {
  kind: string
  values?: string[]
  members?: string[]
}

interface TestDocument {
  schemaVersion: number
  id: string
  scales: Record<string, TestScale>
  axes: TestAxis[]
  levels?: TestLevel[] | undefined
}

function pick<T>(items: readonly T[], match: (item: T) => boolean): T {
  const found = items.find(match)
  if (found === undefined) {
    throw new Error('Test setup: expected item not found in the mutated document.')
  }
  return found
}

// INVARIANT: one axis per scale kind — cumulativity compares differently on each, so a fixture
// missing a kind leaves that comparison unpinned.
const validDocument: TestDocument = {
  schemaVersion: 1,
  id: 'test',
  scales: {
    size: { kind: 'ordinal', values: ['S', 'L'] },
    harness: { kind: 'set', members: ['prompts', 'behavior'] },
    parallelism: { kind: 'numeric' },
  },
  axes: [
    { id: 'size', label: 'Size', scale: 'size' },
    { id: 'harness', label: 'Harness', scale: 'harness' },
    { id: 'parallelism', label: 'In parallel', scale: 'parallelism' },
  ],
  levels: [
    {
      id: 'low',
      rank: 1,
      label: 'Low',
      requirements: [
        { axis: 'size', min: 'S' },
        { axis: 'harness', includes: ['prompts'] },
        { axis: 'parallelism', min: 1 },
      ],
    },
    {
      id: 'high',
      rank: 2,
      label: 'High',
      requirements: [
        { axis: 'size', min: 'L' },
        { axis: 'harness', includes: ['prompts', 'behavior'] },
        { axis: 'parallelism', min: 3 },
      ],
    },
  ],
}

const validSource = YAML.stringify(validDocument)

function mutate(edit: (document: TestDocument) => void): string {
  const document = structuredClone(validDocument)
  edit(document)
  return YAML.stringify(document)
}

// LIMITATION: TestDocument cannot express the `id: 123` a shape test must send; the JSON round-trip
// clones it as JSON.parse's own `any`, which is not a cast.
function mutateShape(edit: (document: ReturnType<typeof JSON.parse>) => void): string {
  const document = JSON.parse(JSON.stringify(validDocument))
  edit(document)
  return YAML.stringify(document)
}

export { validDocument, validSource, mutate, mutateShape, pick }
export type { TestDocument, TestAxis, TestLevel, TestRequirement, TestScale }
