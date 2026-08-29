# Publishing the CLI to npm

The workspace package lives in `packages/cli`. It publishes to npm as **`contextos-memory`** because [`@contextos/cli`](https://www.npmjs.com/package/@contextos/cli) is already taken by another project (bin: `ctx`).

The installed command remains **`contextos`**.

## Pre-flight

```bash
npm run build:cli
npm run test -w contextos-memory
cd packages/cli && npm pack --dry-run
```

Or from the repo root:

```bash
node scripts/pack-cli.mjs
```

## Publish (maintainers)

1. Log in: `npm login`
2. Set `repository` in `packages/cli/package.json` to your real GitHub URL (optional but recommended).
3. From `packages/cli`:

```bash
npm publish --access public --tag beta
```

4. Verify:

```bash
npx contextos-memory@beta --version
npx contextos-memory@beta init --help
```

## Version bumps

Keep `packages/cli/package.json` `version` and `packages/cli/src/constants.ts` `CLI_VERSION` in sync with the monorepo release (see [RELEASE.md](./RELEASE.md)).

## Local install without npm

```bash
npm run build -w contextos-memory
npm link -w contextos-memory
contextos --version
```
