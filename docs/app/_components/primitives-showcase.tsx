import PrimitivesCodeBlock from "./primitives-code-block";
import PrimitivesTabs from "./primitives-tabs";

type PrimitiveTab = {
    code: string;
    filename: string;
    label: string;
};

const tabs: PrimitiveTab[] = [
    {
        label: "Agents",
        filename: "agents.ts",
        code: `export const supportAgent = defineAgent({
  name: "support",
  model: openai("gpt-5.5"),
  contextSchema: z.object({
    userId: z.string(),
    plan: z.enum(["free", "pro", "enterprise"]),
  }),
  instruction: ({ userId, plan }) =>
    \`Resolve the user's issue with \${plan}-level detail. User: \${userId}.\`,
  tools: [searchDocs, createTicket],
});`,
    },
    {
        label: "Tools",
        filename: "tools.ts",
        code: `export const createTicket = defineTool({
  name: "create_ticket",
  target: "server",
  description: "Create a support ticket.",
  inputSchema: z.object({
    title: z.string(),
    priority: z.enum(["low", "high"]),
  }),
  async execute(input, { context }) {
    return tickets.create({
      ...input,
      userId: context.userId,
    });
  },
});`,
    },
    {
        label: "Memory",
        filename: "memory.ts",
        code: `export const app = betterAgent({
  storage: drizzleStorage({ db }),
  memory: createMemory({ lastMessages: 20 }),
  agents: [supportAgent],
});

const support = app.agent("support");

await support.run({
  threadId: "thread_123",
  messages: [{ role: "user", content: "What did I ask before?" }],
  context: { userId: "user_123", plan: "pro" },
});`,
    },
    {
        label: "State",
        filename: "state.ts",
        code: `const supportAgent = defineAgent({
  name: "support",
  model: openai("gpt-5.5"),
  onStepFinish: ({ state }) => state.patch([
    { op: "replace", path: "/step", value: "ready" },
  ]),
});

const result = await app.agent("support").run({
  messages,
  context: { userId: "user_123", plan: "enterprise" },
  state: {
    step: "triage",
    selectedTicketId: null,
    draftReply: "",
  },
});

console.log(result.state);`,
    },
    {
        label: "MCP",
        filename: "mcp.ts",
        code: `const githubTools = mcpTools({
  servers: {
    github: {
      transport: { type: "http", url: "https://api.githubcopilot.com/mcp" },
    },
  },
});

export const devAgent = defineAgent({
  name: "dev",
  model: openai("gpt-5.5"),
  tools: [searchDocs, githubTools],
});
`,
    },
    {
        label: "Auth",
        filename: "auth.ts",
        code: `export const auth = async ({ request }) => {
  const session = await getSession(request);

  return session && {
    subject: session.user.id,
    tenant: session.workspace.id,
    scopes: session.scopes,
  };
};

export const adminAgent = defineAgent({
  name: "admin",
  model: openai("gpt-5.5"),
  access: ({ auth }) => auth?.scopes?.includes("admin") ?? false,
});`,
    },
    {
        label: "Plugins",
        filename: "plugins.ts",
        code: `export const tenantPolicy = definePlugin({
  id: "tenant-policy",
  guards: [
    ({ auth }) => {
      if (auth?.tenant) return null;
      return new Response("Workspace required", { status: 403 });
    },
  ],
  onBeforeModelCall({ messages, context, setMessages }) {
    setMessages([
      { role: "system", content: \`Workspace: \${context.tenantId}\` },
      ...messages,
    ]);
  },
  onAfterToolCall({ toolName, status }) {
    audit.write({ toolName, status });
  },
});`,
    },
    {
        label: "AG-UI",
        filename: "events.ts",
        code: `const stream = await app.agent("support").stream({
  messages: [{ role: "user", content: "Check my ticket." }],
  context: { userId: "user_123" },
});

for await (const event of stream.events) {
  if (event.type === EventType.TEXT_MESSAGE_CONTENT) {
    process.stdout.write(event.delta);
  }
}`,
    },
    {
        label: "Approvals",
        filename: "tools.ts",
        code: `export const refundTool = defineTool({
  name: "refund_payment",
  target: "server",
  inputSchema: z.object({
    orderId: z.string(),
    amount: z.number(),
  }),
  approval: {
    resolve: ({ toolInput }) =>
      toolInput.amount > 100,
  },
  async execute(input) {
    return processRefund(input);
  },
});`,
    },
];

export default function PrimitivesShowcase() {
    const panels = tabs.map((tab) => (
        <PrimitivesCodeBlock code={tab.code} filename={tab.filename} key={tab.label} />
    ));

    return (
        <section className="relative mx-auto w-full max-w-[76rem] px-5 pt-16 pb-16 sm:px-8 sm:pt-20 sm:pb-20 md:pt-24 md:pb-24">
            <div className="mb-6 flex items-center gap-3 sm:mb-8">
                <p className="text-[11px] font-[360] tracking-[0.08em] text-[color:color-mix(in_srgb,var(--foreground)_36%,transparent)] uppercase">
                    Primitives
                </p>
                <div className="h-px flex-1 bg-[color:color-mix(in_srgb,var(--foreground)_8%,transparent)]" />
            </div>

            <h2 className="mb-8 text-[clamp(1.25rem,3vw,1.75rem)] font-[420] leading-tight tracking-[-0.015em] text-[color:color-mix(in_srgb,var(--foreground)_84%,transparent)] sm:mb-10">
                Build on the primitives you need
            </h2>

            <PrimitivesTabs panels={panels} tabs={tabs.map(({ label }) => ({ label }))} />
        </section>
    );
}
