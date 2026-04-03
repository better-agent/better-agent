import {
    betterAgent,
    createMemoryConversationRuntimeStateStore,
    createMemoryConversationStore,
    createMemoryStreamStore,
    defineAgent,
} from "@better-agent/core";
__ENV_IMPORT__
__PROVIDER_IMPORTS__
__PLUGIN_IMPORTS__

__PROVIDER_SETUPS__

__AGENT_DEFINITIONS__

const app = betterAgent({
    agents: [__AGENT_LIST__],
__PLUGIN_BLOCK__
    persistence: {
        stream: createMemoryStreamStore(),
        conversations: createMemoryConversationStore(),
        runtimeState: createMemoryConversationRuntimeStateStore(),
    },
    advanced: {
        onRequestDisconnect: "continue",
    },
    baseURL: "__BASE_URL__",
    secret: __SECRET_ENV__,
});

export default app;
