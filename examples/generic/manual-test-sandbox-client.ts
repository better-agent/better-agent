import { createE2BSandboxClient } from "@better-agent/plugins";

const e2bApiKey = process.env.E2B_API_KEY;

if (!e2bApiKey || e2bApiKey === "your-e2b-api-key") {
    console.error("Missing E2B_API_KEY.");
    process.exit(1);
}

const client = createE2BSandboxClient({
    apiKey: e2bApiKey,
    timeoutMs: 10 * 60 * 1000,
});

const logStep = (title: string, details?: string) => {
    console.log(`\n[${title}]`);
    if (details) {
        console.log(details);
    }
};

let sandboxId: string | undefined;

try {
    const created = await client.createSandbox({
        metadata: {
            source: "better-agent-example",
        },
    });
    sandboxId = created.sandboxId;
    logStep("sandbox:create", `sandboxId=${sandboxId}`);

    const directory = "/workspace/demo";
    const filePath = `${directory}/hello.txt`;
    const fileContent = "hello from the direct sandbox client test\n";

    const directoryResult = await client.makeDir({
        sandboxId,
        path: directory,
    });
    logStep("sandbox:makeDir", `path=${directory} created=${String(directoryResult.created)}`);

    const writeResult = await client.writeFile({
        sandboxId,
        path: filePath,
        content: fileContent,
    });
    logStep("sandbox:writeFile", `path=${writeResult.path}`);

    const readResult = await client.readFile({
        sandboxId,
        path: filePath,
    });
    logStep("sandbox:readFile", readResult.trim());

    const listResult = await client.listFiles({
        sandboxId,
        path: directory,
    });
    logStep(
        "sandbox:listFiles",
        listResult.map((entry) => `${entry.type ?? "unknown"} ${entry.path}`).join("\n"),
    );

    const commandResult = await client.runCommand({
        sandboxId,
        cmd: "pwd && ls -la /workspace/demo && cat /workspace/demo/hello.txt",
        cwd: "/workspace",
        timeoutMs: 30_000,
    });
    logStep(
        "sandbox:exec",
        [
            `exitCode=${String(commandResult.exitCode ?? "unknown")}`,
            commandResult.stdout?.trim() ?? "",
            commandResult.stderr?.trim() ?? "",
        ]
            .filter(Boolean)
            .join("\n"),
    );

    console.log("\nDirect sandbox client smoke test completed successfully.");
    console.log(
        "This proves the provider adapter can create a sandbox, write files, read files, and execute commands.",
    );
    console.log(
        "If you also want to see the full agent loop, run `bun run sandbox:test:agent` with OPENAI_API_KEY and E2B_API_KEY set.",
    );
} catch (error) {
    console.error("\nDirect sandbox client test failed.");
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
} finally {
    if (sandboxId) {
        try {
            await client.killSandbox({ sandboxId });
            logStep("sandbox:kill", `sandboxId=${sandboxId}`);
        } catch (error) {
            console.error("\nFailed to clean up sandbox.");
            console.error(error instanceof Error ? error.message : String(error));
            process.exitCode = 1;
        }
    }
}
