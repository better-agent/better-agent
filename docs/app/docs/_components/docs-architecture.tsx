import {
    Activity,
    Bot,
    Boxes,
    Braces,
    Brain,
    Code2,
    KeyRound,
    Network,
    Puzzle,
    Users,
    Wrench,
} from "lucide-react";
import type { ReactNode } from "react";
import {
    siAnthropic,
    siBetterauth,
    siClerk,
    siCloudflare,
    siDrizzle,
    siExpress,
    siGooglegemini,
    siHono,
    siNextdotjs,
    siOllama,
    siOpenrouter,
    siPrisma,
    siReact,
    siRedis,
    siRemix,
    siSolid,
    siSvelte,
    siVercel,
    siVuedotjs,
} from "simple-icons";

type IconDef = { path: string; title: string };

const OPENAI_ICON: IconDef = {
    title: "OpenAI",
    path: "M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364l2.0201-1.1638a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.4092-.6813zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0974-2.3616l2.603-1.5018 2.6032 1.5018v3.0036l-2.6032 1.5018-2.603-1.5018z",
};

const XAI_ICON: IconDef = {
    title: "xAI",
    path: "M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z",
};

function BrandSvg({ icon, size = 14 }: { icon: IconDef; size?: number }) {
    return (
        <svg
            aria-hidden
            viewBox="0 0 24 24"
            fill="currentColor"
            width={size}
            height={size}
            className="shrink-0"
        >
            <title>{icon.title}</title>
            <path d={icon.path} />
        </svg>
    );
}

function SiBrand({ si, size = 14 }: { si: { path: string; title: string }; size?: number }) {
    return <BrandSvg icon={{ path: si.path, title: si.title }} size={size} />;
}

function KyselyLogo({ size = 14 }: { size?: number }) {
    return (
        <svg
            aria-hidden
            className="shrink-0"
            fill="none"
            height={size}
            viewBox="0 0 132 132"
            width={size}
        >
            <title>Kysely</title>
            <rect fill="currentColor" height="128" opacity="0.86" rx="16" width="128" x="2" y="2" />
            <path
                d="M41.2983 109V23.9091H46.4918V73.31H47.0735L91.9457 23.9091H98.8427L61.9062 64.1694L98.5103 109H92.0288L58.5824 67.9087L46.4918 81.2873V109H41.2983Z"
                fill="var(--ba-bg)"
            />
            <rect
                height="128"
                rx="16"
                stroke="currentColor"
                strokeWidth="4"
                width="128"
                x="2"
                y="2"
            />
        </svg>
    );
}

function AgentAuthLogo({ size = 14 }: { size?: number }) {
    return (
        <svg
            aria-hidden
            className="shrink-0"
            fill="none"
            height={size}
            viewBox="0 0 344 280"
            width={size}
        >
            <title>Agent Auth</title>
            <path
                d="M71 204.359L119.629 72H141.665L173.311 165.036L165.89 183.969L158.951 166.702H102.343L88.8561 204.359H71ZM107.852 151.043H153.442L130.647 85.9816L107.852 151.043Z"
                fill="currentColor"
            />
            <path
                d="M158.951 208L207.58 75.6409H229.616L272 208H257.902L246.902 170.343H190.294L176.807 208H158.951ZM195.803 154.684H241.393L218.598 89.6225L195.803 154.684Z"
                fill="currentColor"
            />
        </svg>
    );
}

function Chip({ children, dense = false }: { children: ReactNode; dense?: boolean }) {
    return (
        <span
            className={`ba-stack-box-rails relative inline-flex items-center gap-1.5 overflow-hidden border font-mono tracking-wide ${
                dense ? "min-h-6 px-2 py-0.5 text-[9px]" : "min-h-7 px-2.5 py-1 text-[9.5px]"
            }`}
            style={{
                borderColor: "var(--stack-border)",
                background: "var(--stack-chip)",
                color: "var(--stack-text)",
            }}
        >
            {children}
        </span>
    );
}

function CoreChip({ children }: { children: ReactNode }) {
    return (
        <span
            className="ba-stack-box-rails relative inline-flex min-h-7 items-center gap-1.5 overflow-hidden border px-2.5 py-1 font-mono text-[9.5px] tracking-wide"
            style={{
                borderColor: "var(--stack-border)",
                background: "var(--stack-chip)",
                color: "var(--stack-text)",
            }}
        >
            {children}
        </span>
    );
}

function GroupLabel({ children }: { children: ReactNode }) {
    return (
        <span
            className="mb-3 block font-mono text-[8.5px] uppercase tracking-[0.18em]"
            style={{ color: "var(--stack-muted)" }}
        >
            {children}
        </span>
    );
}

function Group({
    label,
    children,
    highlight,
    dense,
    className,
}: {
    label: string;
    children: ReactNode;
    highlight?: boolean;
    dense?: boolean;
    className?: string;
}) {
    return (
        <div
            className={`ba-stack-box-rails relative overflow-hidden border ${dense ? "min-h-[5.8rem] p-3" : "min-h-[6.35rem] p-3.5"} ${className ?? ""}`}
            style={{
                borderColor: highlight ? "var(--stack-border-strong)" : "var(--stack-border)",
                background: highlight ? "var(--stack-panel-strong)" : "var(--stack-panel)",
            }}
        >
            <div
                className="pointer-events-none absolute left-0 top-0 h-px w-10"
                style={{ background: "var(--stack-border-strong)" }}
            />
            <div
                className="pointer-events-none absolute left-0 top-0 h-10 w-px"
                style={{ background: "var(--stack-border-strong)" }}
            />
            <div className="relative">
                <GroupLabel>{label}</GroupLabel>
                <div className={`flex flex-wrap ${dense ? "gap-1" : "gap-1.5"}`}>{children}</div>
            </div>
        </div>
    );
}

function RailNode({ className }: { className?: string }) {
    return (
        <div
            className={`absolute size-1.5 border ${className ?? ""}`}
            style={{
                borderColor: "var(--stack-border-strong)",
                background: "var(--stack-bg)",
            }}
        />
    );
}

function TopConnector() {
    return (
        <div className="relative h-5 md:h-7">
            <div
                className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 md:hidden"
                style={{ background: "var(--stack-rail)" }}
            />
            <div
                className="absolute left-[25%] top-0 hidden h-full w-px md:block"
                style={{ background: "var(--stack-rail)" }}
            />
            <div
                className="absolute left-[75%] top-0 hidden h-full w-px md:block"
                style={{ background: "var(--stack-rail)" }}
            />
            <RailNode className="left-[25%] top-1/2 hidden -translate-x-1/2 -translate-y-1/2 md:block" />
            <RailNode className="left-[75%] top-1/2 hidden -translate-x-1/2 -translate-y-1/2 md:block" />
            <RailNode className="left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 md:hidden" />
        </div>
    );
}

function BottomConnector() {
    return (
        <div className="relative h-5 md:h-7">
            <div
                className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 md:hidden"
                style={{ background: "var(--stack-rail)" }}
            />
            <div
                className="absolute left-[16.666%] top-0 hidden h-full w-px md:block"
                style={{ background: "var(--stack-rail)" }}
            />
            <div
                className="absolute left-1/2 top-0 hidden h-full w-px -translate-x-1/2 md:block"
                style={{ background: "var(--stack-rail)" }}
            />
            <div
                className="absolute left-[83.334%] top-0 hidden h-full w-px md:block"
                style={{ background: "var(--stack-rail)" }}
            />
            <RailNode className="left-[16.666%] top-1/2 hidden -translate-x-1/2 -translate-y-1/2 md:block" />
            <RailNode className="left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" />
            <RailNode className="left-[83.334%] top-1/2 hidden -translate-x-1/2 -translate-y-1/2 md:block" />
        </div>
    );
}

export function DocsArchitecture({ className }: { className?: string }) {
    return (
        <section className={`not-prose py-6 md:py-10 ${className ?? ""}`} aria-label="Architecture">
            <div className="mb-4 flex flex-col items-center">
                <h2
                    className="font-mono text-[11px] uppercase tracking-[0.28em]"
                    style={{ color: "color-mix(in srgb, var(--ba-fg) 82%, transparent)" }}
                >
                    The Stack
                </h2>
                <div className="mt-2 flex w-44 items-center gap-2">
                    <div
                        className="h-px flex-1"
                        style={{
                            background: "color-mix(in srgb, var(--ba-fg) 12%, transparent)",
                        }}
                    />
                    <div
                        className="size-1.5 border"
                        style={{
                            borderColor: "color-mix(in srgb, var(--ba-fg) 18%, transparent)",
                            background: "color-mix(in srgb, var(--ba-fg) 1.5%, var(--ba-bg))",
                        }}
                    />
                    <div
                        className="h-px flex-1"
                        style={{
                            background: "color-mix(in srgb, var(--ba-fg) 12%, transparent)",
                        }}
                    />
                </div>
            </div>

            <div
                className="ba-stack-shell relative overflow-hidden border"
                style={{
                    borderColor: "var(--stack-border)",
                    background: "var(--stack-bg)",
                }}
            >
                <div className="relative flex w-full flex-col p-3 md:p-4">
                    {/* Top row: Server + Auth */}
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
                        <Group label="Your server">
                            <Chip>
                                <SiBrand si={siNextdotjs} /> Next.js
                            </Chip>
                            <Chip>
                                <SiBrand si={siHono} /> Hono
                            </Chip>
                            <Chip>
                                <SiBrand si={siExpress} /> Express
                            </Chip>
                            <Chip>
                                <SiBrand si={siRemix} /> Remix
                            </Chip>
                            <Chip>
                                <SiBrand si={siSvelte} /> SvelteKit
                            </Chip>
                        </Group>
                        <Group label="Your auth">
                            <Chip>
                                <SiBrand si={siBetterauth} /> Better Auth
                            </Chip>
                            <Chip>
                                <AgentAuthLogo /> Agent Auth
                            </Chip>
                            <Chip>
                                <SiBrand si={siClerk} /> Clerk
                            </Chip>
                            <Chip>
                                <KeyRound className="size-3.5" strokeWidth={1.5} /> Custom
                            </Chip>
                        </Group>
                    </div>

                    <TopConnector />

                    {/* Core */}
                    <div
                        className="ba-stack-box-rails relative mx-auto flex w-full max-w-3xl flex-col items-center overflow-hidden border px-4 py-3.5 text-center"
                        style={{
                            borderColor: "var(--stack-border-strong)",
                            background: "var(--stack-hub)",
                        }}
                    >
                        <div
                            className="pointer-events-none absolute inset-x-0 top-0 h-px"
                            style={{
                                background: "var(--stack-edge)",
                            }}
                        />
                        <div
                            className="pointer-events-none absolute inset-x-0 bottom-0 h-px"
                            style={{
                                background: "var(--stack-edge)",
                            }}
                        />
                        <span
                            className="mb-3 block font-mono text-[10.5px] uppercase tracking-[0.2em]"
                            style={{ color: "var(--stack-title)" }}
                        >
                            Better Agent
                        </span>
                        <div className="flex flex-wrap justify-center gap-1.5">
                            <CoreChip>
                                <Bot className="size-3.5" strokeWidth={1.5} /> Agent
                            </CoreChip>
                            <CoreChip>
                                <Code2 className="size-3.5" strokeWidth={1.5} /> Typed APIs
                            </CoreChip>
                            <CoreChip>
                                <Activity className="size-3.5" strokeWidth={1.5} /> AG-UI Events
                            </CoreChip>
                            <CoreChip>
                                <Wrench className="size-3.5" strokeWidth={1.5} /> Tools
                            </CoreChip>
                            <CoreChip>
                                <Users className="size-3.5" strokeWidth={1.5} /> Human Loop
                            </CoreChip>
                            <CoreChip>
                                <Network className="size-3.5" strokeWidth={1.5} /> MCP
                            </CoreChip>
                            <CoreChip>
                                <Braces className="size-3.5" strokeWidth={1.5} /> Structured Output
                            </CoreChip>
                            <CoreChip>
                                <Boxes className="size-3.5" strokeWidth={1.5} /> State
                            </CoreChip>
                            <CoreChip>
                                <Brain className="size-3.5" strokeWidth={1.5} /> Memory
                            </CoreChip>
                            <CoreChip>
                                <Puzzle className="size-3.5" strokeWidth={1.5} /> Plugins
                            </CoreChip>
                        </div>
                    </div>

                    <BottomConnector />

                    {/* Bottom row: Providers + Storage + Client */}
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-4">
                        <Group label="Providers" dense className="ba-stack-lower-group">
                            <Chip dense>
                                <BrandSvg icon={OPENAI_ICON} /> OpenAI
                            </Chip>
                            <Chip dense>
                                <SiBrand si={siAnthropic} /> Anthropic
                            </Chip>
                            <Chip dense>
                                <SiBrand si={siGooglegemini} /> Gemini
                            </Chip>
                            <Chip dense>
                                <BrandSvg icon={XAI_ICON} /> xAI
                            </Chip>
                            <Chip dense>
                                <SiBrand si={siOllama} /> Ollama
                            </Chip>
                            <Chip dense>
                                <SiBrand si={siOpenrouter} /> OpenRouter
                            </Chip>
                            <Chip dense>
                                <SiBrand si={siCloudflare} /> Workers AI
                            </Chip>
                            <Chip dense>
                                <SiBrand si={siVercel} /> Vercel AI SDK
                            </Chip>
                        </Group>

                        <Group label="Storage" dense className="ba-stack-lower-group">
                            <Chip dense>
                                <SiBrand si={siDrizzle} /> Drizzle
                            </Chip>
                            <Chip dense>
                                <SiBrand si={siPrisma} /> Prisma
                            </Chip>
                            <Chip dense>
                                <KyselyLogo /> Kysely
                            </Chip>
                            <Chip dense>
                                <SiBrand si={siRedis} /> Redis
                            </Chip>
                        </Group>

                        <Group label="Client SDK" dense className="ba-stack-lower-group">
                            <Chip dense>
                                <SiBrand si={siReact} /> React
                            </Chip>
                            <Chip dense>
                                <SiBrand si={siVuedotjs} /> Vue
                            </Chip>
                            <Chip dense>
                                <SiBrand si={siSvelte} /> Svelte
                            </Chip>
                            <Chip dense>
                                <SiBrand si={siSolid} /> Solid
                            </Chip>
                        </Group>
                    </div>
                </div>
            </div>
        </section>
    );
}
