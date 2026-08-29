# Publishing the CLI to npm

The workspace package lives in `packages/cli`. It publishes to npm as **`contextos-memory`** because [`@contextos/cli`](https://www.npmjs.com/package/@contextos/cli) is already taken by another project (bin: `ctx`).

The installed command remains **`contextos`**.

## Install today (GitHub release)

```bash
npm install -g https://github.com/carlogiovannifalocco-byte/contextos-v1/releases/download/v1.0.0-beta/contextos-memory-1.0.0-beta.tgz
contextos init --api http://127.0.0.1:3010
```

Upload a new tarball after version bumps: `npm run upload:cli-release`.

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

**Option A — GitHub Actions (recommended)**

1. Create an npm access token (Automation or Publish) at https://www.npmjs.com/settings/~/tokens
2. Add it as repo secret **`NPM_TOKEN`** on GitHub (Settings → Secrets → Actions)
3. Re-publish the release (or create a patch release). Workflow: `.github/workflows/publish-cli.yml` runs on `release: published`.

**Option B — local**

1. Log in: `npm login`
2. From `packages/cli`:

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
