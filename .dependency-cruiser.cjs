/**
 * Architecture boundaries, enforced mechanically.
 *
 * INSTALL.md step 5: this is the wall parallel worktree agents are most likely
 * to breach, so it must fail in `pnpm architecture`, not in review.
 */
module.exports = {
  forbidden: [
    {
      name: 'maturity-is-a-peer',
      comment: 'maturity/ is a peer of evidence/ and never depends on evidence, assessment or cli.',
      severity: 'error',
      from: { path: '^src/maturity/' },
      to: { path: '^src/(evidence|assessment|cli)/' },
    },
    {
      name: 'evidence-is-a-peer',
      comment: 'evidence/ is a peer of maturity/ and never depends on maturity, assessment or cli.',
      severity: 'error',
      from: { path: '^src/evidence/' },
      to: { path: '^src/(maturity|assessment|cli)/' },
    },
    {
      name: 'assessment-composes-never-adapts',
      comment: 'assessment/ orchestrates public use cases; it never imports a concrete adapter.',
      severity: 'error',
      from: { path: '^src/assessment/' },
      to: { path: '^src/[^/]+/adapters/' },
    },
    {
      name: 'assessment-never-depends-on-cli',
      comment: 'Driving adapters depend on assessment, never the reverse.',
      severity: 'error',
      from: { path: '^src/assessment/' },
      to: { path: '^src/cli/' },
    },
    {
      name: 'domain-has-no-filesystem',
      comment:
        'Infrastructure crosses inward through ports. Models and use cases never touch the disk.',
      severity: 'error',
      from: { path: '^src/[^/]+/(models|usecases|contracts|engine)/' },
      to: { dependencyTypes: ['core'], path: '^(node:)?(fs|fs/promises|path|os)$' },
    },
    {
      name: 'domain-has-no-processes',
      comment: 'Git is reached through an adapter, never spawned from a use case.',
      severity: 'error',
      from: { path: '^src/[^/]+/(models|usecases|contracts|engine)/' },
      to: { dependencyTypes: ['core'], path: '^(node:)?child_process$' },
    },
    {
      name: 'domain-has-no-vendor-sdk',
      comment:
        'The YAML parser belongs to maturity/adapters/. No domain or use-case file imports a vendor package.',
      severity: 'error',
      from: { path: '^src/[^/]+/(models|usecases|contracts|engine)/' },
      to: {
        dependencyTypes: [
          'npm',
          'npm-dev',
          'npm-optional',
          'npm-peer',
          'npm-no-pkg',
          'npm-unknown',
        ],
      },
    },
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-orphans',
      severity: 'warn',
      comment:
        'A public contract or a port is legitimately unreferenced until an adapter binds to it.',
      from: {
        orphan: true,
        pathNot: ['\\.d\\.ts$', '^src/[^/]+/(contracts|ports)/'],
      },
      to: {},
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '^(profiles|dist)/' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node'],
    },
  },
}
