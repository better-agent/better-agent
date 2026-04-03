import { describe, expect, test } from "bun:test";
import { createAgentRegistry } from "../../src/run/registry";
import { createTextAgent } from "../helpers/mock-model";

describe("createAgentRegistry", () => {
    test("creates registry from agents array", () => {
        const registry = createAgentRegistry([createTextAgent({ name: "assistant" })]);
        expect(registry.get("assistant")?.name).toBe("assistant");
    });

    test("empty agents array produces empty registry", () => {
        expect(createAgentRegistry([]).size).toBe(0);
    });
});
