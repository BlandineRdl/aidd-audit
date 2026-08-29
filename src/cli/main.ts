import { runAssess } from './commands/assess.command.js'

// The only file that touches `process`, so `runAssess` stays testable in-process.
const exitCode = await runAssess(process.argv.slice(2), {
  stdout: (text) => {
    process.stdout.write(text)
  },
  stderr: (text) => {
    process.stderr.write(text)
  },
})

// Never process.exit(): it truncates a pending write.
process.exitCode = exitCode
