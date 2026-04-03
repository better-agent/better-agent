import { describe, expectTypeOf, test } from "bun:test";
import { definePlugin } from "../../src/plugins";
import type { PluginOnStepContext } from "../../src/plugins";
import type { Capabilities } from "../../src/providers";

type ToolCaps = { tools: true } & Capabilities;

describe("plugin contexts typing", () => {
    test("plugin step context keeps unknown context and gates tool controls", () => {
        definePlugin({
            id: "test-plugin",
            onStep(ctx) {
                expectTypeOf(ctx.context).toEqualTypeOf<unknown>();
            },
            onBeforeModelCall(ctx) {
                ctx.setInput([...ctx.input]);
            },
            onBeforeSave(ctx) {
                ctx.setItems([...ctx.items]);
            },
        });

        expectTypeOf<PluginOnStepContext<ToolCaps>>().toHaveProperty("setToolChoice");
        expectTypeOf<PluginOnStepContext<ToolCaps>>().toHaveProperty("setActiveTools");
        expectTypeOf<PluginOnStepContext>().not.toHaveProperty("setToolChoice");
        expectTypeOf<PluginOnStepContext>().not.toHaveProperty("setActiveTools");
    });
});
