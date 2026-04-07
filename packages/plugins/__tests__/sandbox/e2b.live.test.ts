import { describe, expect, test } from "bun:test";
import { createE2BSandboxClient } from "../../src";

const hasE2BEnv = Boolean(process.env.E2B_API_KEY);
const describeE2B = hasE2BEnv ? describe : describe.skip;

describeE2B("createE2BSandboxClient live", () => {
    test("creates a sandbox, runs a command, writes/reads a file, and cleans up", async () => {
        const client = createE2BSandboxClient({
            apiKey: process.env.E2B_API_KEY,
            ...(process.env.E2B_DOMAIN ? { domain: process.env.E2B_DOMAIN } : {}),
        });

        const created = await client.createSandbox();

        try {
            expect(created.sandboxId.length).toBeGreaterThan(0);

            const command = await client.runCommand({
                sandboxId: created.sandboxId,
                cmd: "echo hello",
            });
            expect(command.exitCode).toBe(0);
            expect(command.stdout).toContain("hello");

            await client.writeFile({
                sandboxId: created.sandboxId,
                path: "/tmp/better-agent-live.txt",
                content: "live-e2b",
            });
            const content = await client.readFile({
                sandboxId: created.sandboxId,
                path: "/tmp/better-agent-live.txt",
            });
            expect(content).toContain("live-e2b");
        } finally {
            await client.killSandbox({ sandboxId: created.sandboxId });
        }
    }, 120_000);
});
