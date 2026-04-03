# Contributing

TypeScript monorepo using Bun and Turbo.

## Development Setup

- Node.js `>=20`
- Bun `>=1.3.3`

```sh
bun install
```

## Working in the Repo

Most source code lives in `packages/`.

- `packages/`: core libraries and runtime packages
- `examples/`: example applications and integration references
- `docs/`: documentation site and written guides

```sh
bun run build
bun run typecheck
bun run lint:ci
bun run check
```

Use `bun run check` before opening a pull request when your change affects behavior across packages.

## Guidelines

- Keep changes focused and avoid unrelated refactors.
- Follow the existing code style and project structure.
- Update documentation when behavior or public APIs change.
- Add or update tests when fixing bugs or changing behavior.
- Use semantic commit messages.
- Use semantic pull request titles.

## Pull Requests

- Explain what changed and why.
- Link the related issue when relevant.
- Mention the checks you ran.
- Include screenshots for documentation or UI changes when they help review.
