import { stat } from 'node:fs/promises'
import { join } from 'node:path'

// A marker, never a source: nothing in it is admissible for any axis.
const BUNDLE_MANIFEST = 'profile.json'

export async function isBundle(path: string): Promise<boolean> {
  try {
    return (await stat(join(path, BUNDLE_MANIFEST))).isFile()
  } catch {
    return false
  }
}
