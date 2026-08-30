import { runAssess } from './commands/assess.command.js'

// SAFETY: NO_COLOR wins over FORCE_COLOR. An off switch another variable can override is not an off
// switch, and a caller that set it has said what it wants louder than an inherited environment can.
// Both are read as set-and-non-empty, per no-color.org.
//
// INVARIANT: without either, colour follows the terminal. A pipe, a file and a captured run get the
// same bytes they got before colour existed, so `assess . | grep`, a redirect and the gate are all
// unaffected.
function coloursWanted(): boolean {
  const off = process.env.NO_COLOR
  if (off !== undefined && off !== '') return false
  const on = process.env.FORCE_COLOR
  if (on !== undefined && on !== '') return true
  return process.stdout.isTTY === true
}

// The only file that touches `process`, so `runAssess` stays testable in-process.
const exitCode = await runAssess(process.argv.slice(2), {
  stdout: (text) => {
    process.stdout.write(text)
  },
  stderr: (text) => {
    process.stderr.write(text)
  },
  colours: coloursWanted(),
})

// Never process.exit(): it truncates a pending write.
process.exitCode = exitCode
