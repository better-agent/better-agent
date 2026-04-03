import PrimitivesCodeBlock from "./primitives-code-block";
import PrimitivesTabs from "./primitives-tabs";

type PrimitiveTab = {
    code: string;
    filename: string;
    label: string;
    language?: "ts" | "tsx" | "js" | "jsx" | "json" | "bash" | "sh" | "text";
};

const tabs: PrimitiveTab[] = [
    {
        label: "Agents",
        filename: "agents.ts",
        code: `export const supportAgent = defineAgent({
  name: "support",
  model: openai.model("gpt-5.4"),
  instruction: "Help users resolve account issues.",
  tools: [searchDocsTool, createTicketTool],
});`,
    },
    {
        label: "Tools",
        filename: "tools.ts",
        code: `export const searchDocsTool = defineTool({
  name: "search_docs",
  description: "Search product docs",
  schema: z.object({
    query: z.string(),
    limit: z.number().default(5),
  }),
}).server(async ({ query, limit }) => {
  return docs.search(query, limit);
});`,
    },
    {
        label: "Plugins",
        filename: "plugins.ts",
        code: `export const auditPlugin = definePlugin({
  id: "audit",
  guards: [
    async ({ request }) => {
      if (!request.headers.get("x-api-key")) {
        return new Response("API key required", { status: 401 });
      }
      return null;
    },
  ],
});`,
    },
    {
        label: "App",
        filename: "app.ts",
        code: `export const app = betterAgent({
  agents: [supportAgent],
  tools: [searchDocsTool],
  plugins: [auditPlugin],
  baseURL: "/agents",
  secret: "dev-secret",
});`,
    },
    {
        label: "Handler",
        filename: "server.ts",
        code: `export async function POST(request: Request) {
  return ba.handler(request);
}`,
    },
    {
        label: "Approvals",
        filename: "tools.ts",
        code: `export const refundPaymentTool = defineTool({
  name: "refund_payment",
  schema: z.object({
    orderId: z.string(),
    amount: z.number(),
  }),
  approval: {
    resolve: ({ input }) => ({
      required: input.amount > 100,
      timeoutMs: "1m",
    }),
  },
}).server(processRefund);`,
    },
    {
        label: "Persistence",
        filename: "persistence.ts",
        code: `export const app = betterAgent({
  agents: [supportAgent],
  persistence: {
    stream: createMemoryStreamStore(),
    conversations: createMemoryConversationStore(),
    runtimeState: createMemoryConversationRuntimeStateStore(),
  },
});`,
    },
];

export default async function PrimitivesShowcase() {
    const panels = await Promise.all(
        tabs.map(async (tab) => (
            <PrimitivesCodeBlock
                code={tab.code}
                filename={tab.filename}
                key={tab.label}
                language={tab.language}
            />
        )),
    );

    return (
        <section className="relative mx-auto w-full max-w-[76rem] px-5 pt-16 pb-16 sm:px-8 sm:pt-20 sm:pb-20 md:pt-24 md:pb-24">
            <div className="mb-6 flex items-center gap-3 sm:mb-8">
                <p className="text-[11px] font-medium tracking-[0.08em] text-[color:color-mix(in_srgb,var(--foreground)_40%,transparent)] uppercase">
                    Primitives
                </p>
                <div className="h-px flex-1 bg-[color:color-mix(in_srgb,var(--foreground)_8%,transparent)]" />
            </div>

            <h2 className="mb-8 text-[clamp(1.25rem,3vw,1.75rem)] font-semibold leading-tight tracking-[-0.03em] text-[color:var(--foreground)] sm:mb-10">
                Build on the primitives you need
            </h2>

            <PrimitivesTabs panels={panels} tabs={tabs.map(({ label }) => ({ label }))} />
        </section>
    );
}
