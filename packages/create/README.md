# create-better-agent

Create a new Better Agent app.

## Usage

Run the interactive scaffold:

```bash
npm create better-agent
```

Or provide the scaffold options directly:

```bash
npm create better-agent my-agent-app -- --framework nextjs --providers openai --plugins logging --no-install
```

Supports `nextjs`, `sveltekit`, `remix`, `astro`, `nuxt`, `tanstack-start`, and `solid-start`.

Providers: `openai`, `anthropic`, `gemini`, `xai`, `ollama`, `openrouter`, and `workers-ai`.

Plugins: `ip-allowlist`, `logging`, `rate-limit`, and `sandbox`.
