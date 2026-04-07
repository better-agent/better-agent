import { describe, expect, test } from "bun:test";
import { createDaytonaSandboxClient } from "../../src";

const hasDaytonaEnv = Boolean(process.env.DAYTONA_API_KEY);
const describeDaytona = hasDaytonaEnv ? describe : describe.skip;

describeDaytona("createDaytonaSandboxClient live", () => {
    test("creates a sandbox, runs a command, writes/reads a file, and cleans up", async () => {
        const client = createDaytonaSandboxClient({
            apiKey: process.env.DAYTONA_API_KEY,
            ...(process.env.DAYTONA_API_URL ? { apiUrl: process.env.DAYTONA_API_URL } : {}),
            ...(process.env.DAYTONA_TARGET ? { target: process.env.DAYTONA_TARGET } : {}),
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
                content: "live-daytona",
            });
            const content = await client.readFile({
                sandboxId: created.sandboxId,
                path: "/tmp/better-agent-live.txt",
            });
            expect(content).toContain("live-daytona");
        } finally {
            await client.killSandbox({ sandboxId: created.sandboxId });
        }
    }, 120_000);
});
