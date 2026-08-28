#!/usr/bin/env node
import { execFileSync } from "node:child_process";

const changed = execFileSync("git", ["diff", "--name-only", "--diff-filter=ACM"], {
  encoding: "utf8",
}).split("\n").filter(Boolean);

const problems = [];

for (const file of changed.filter((f) => f.endsWith(".go"))) {
  const body = execFileSync("cat", [file], { encoding: "utf8" });

  // Errors dropped on the floor. `_ = err` is the form that gets past review.
  if (/\b_\s*=\s*err\b/.test(body)) {
    problems.push(`${file}: an error is assigned to _ — see .claude/rules/go.md`);
  }
  // A query without a deadline holds one of 20 pool connections.
  if (/db\.Query(Row)?\(\s*(?!ctx)/.test(body)) {
    problems.push(`${file}: a query runs without a context — see .claude/rules/sql.md`);
  }
}

if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(2); // non-zero: the assistant sees this and has to fix it
}
