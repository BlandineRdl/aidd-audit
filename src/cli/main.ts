import { runAssess } from './commands/assess.command.js'
import { runHarness } from './commands/harness.command.js'

// The only file that touches `process`, so `runAssess` and `runHarness` stay testable in-process.
const argv = process.argv.slice(2)

// LIMITATION: importing the harness command statically evaluates the token encoder's vocabulary on
// every invocation, including an `assess` that never counts a token, and costs it roughly 0.11s.
// Importing it dynamically removes that cost and splits the bundle into three files, which breaks
// the single `dist/cli.js` entry point `architecture.md` states. The cost is paid deliberately: it
// changes no published byte and no exit code, and the one-file property is the one consumers see.
const run = argv[0] === 'harness' ? runHarness : runAssess

const exitCode = await run(argv, {
  stdout: (text) => {
    process.stdout.write(text)
  },
  stderr: (text) => {
    process.stderr.write(text)
  },
})

// Never process.exit(): it truncates a pending write.
process.exitCode = exitCode
