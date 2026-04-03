#!/usr/bin/env node
import { parseArgs, run } from "./command";
import { enableInteractivePrompts } from "./prompt";

const main = async () => {
    enableInteractivePrompts();
    const code = await run(parseArgs(process.argv.slice(2)));
    process.exitCode = code;
};

if (process.argv[1]) {
    void main().catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Create Better Agent failed.";
        console.error(message);
        process.exitCode = 1;
    });
}

export type * from "./types";
export { parseArgs, run };
