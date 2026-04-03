# @better-agent/cli

CLI utilities for Better Agent.

## Commands

### `better-agent generate type`

Generate a portable client app type from Better Agent config exports.

```bash
better-agent generate type --config ./better-agent.ts
```

Useful options:

- `--config <path...>`: one or more Better Agent config paths
- `--cwd <path>`: base directory for resolving relative config paths
- `--out <path>`: output `.d.ts` path, defaults to `better-agent.types.d.ts`
- `--name <identifier>`: exported type alias name, defaults to `BAClientApp`
- `--yes`: skip prompts and overwrite output
