"use client";

import {
    Activity,
    Blocks,
    GitFork,
    Layers,
    Plug,
    RefreshCcw,
    Route,
    ShieldCheck,
    Wrench,
} from "lucide-react";
import {
    siAnthropic,
    siAstro,
    siBun,
    siCloudflare,
    siCloudflareworkers,
    siDeno,
    siGooglegemini,
    siNextdotjs,
    siNodedotjs,
    siNuxt,
    siOllama,
    siOpenrouter,
    siPreact,
    siRemix,
    siSolid,
    siSvelte,
} from "simple-icons";
import { type GridFeature, GridFeatureCard } from "./grid-feature-card";
type BrandIcon = {
    name: string;
    color: string;
    path: string;
};

function BrandLogo({ brand, size = 16 }: { brand: BrandIcon; size?: number }) {
    const isBlack = brand.color === "#000000";
    return (
        <svg
            aria-label={brand.name}
            className="shrink-0"
            fill="currentColor"
            height={size}
            role="img"
            style={isBlack ? undefined : { color: brand.color }}
            viewBox="0 0 24 24"
            width={size}
        >
            <path d={brand.path} />
        </svg>
    );
}
const runtimes: BrandIcon[] = [
    { si: siNodedotjs, name: "Node.js" },
    { si: siBun, name: "Bun" },
    { si: siDeno, name: "Deno" },
    { si: siCloudflare, name: "Cloudflare" },
].map(({ si, name }: { si: { hex: string; path: string }; name: string }) => ({
    name,
    color: `#${si.hex}`,
    path: si.path,
}));
const frameworks: BrandIcon[] = [
    { si: siAstro, name: "Astro" },
    { si: siNextdotjs, name: "Next.js" },
    { si: siNuxt, name: "Nuxt" },
    { si: siPreact, name: "Preact" },
    { si: siRemix, name: "Remix" },
    { si: siSolid, name: "Solid" },
    { si: siSvelte, name: "Svelte" },
].map(({ si, name }: { si: { hex: string; path: string }; name: string }) => ({
    name,
    color: `#${si.hex}`,
    path: si.path,
}));
const manualProviders: BrandIcon[] = [
    {
        name: "OpenAI",
        color: "#000000",
        path: "M22.06755 9.86655c0.53155 -1.600775 0.34755 -3.352975 -0.50495 -4.8084C20.2808 2.826925 17.7045 1.67919 15.18845 2.21849c-1.4179 -1.577185 -3.569275 -2.2785285 -5.644275 -1.840025C7.46915 0.81697 5.785475 2.3287575 5.1269 4.34475c-1.652725 0.338925 -3.079185 1.37375 -3.9143575 2.83965C-0.08323475 9.412025 0.21087275 12.22195 1.939825 14.132975c-0.5335675 1.60005 -0.3512325 3.352475 0.5002975 4.808425C3.72355 21.173375 6.301525 22.321025 8.818925 21.78105c1.119725 1.260875 2.728375 1.978275 4.41465 1.96885 2.578975 0.0023 4.863725 -1.662575 5.651525 -4.118275 1.652475 -0.3395 3.078725 -1.37415 3.91435 -2.83965 1.280125 -2.223675 0.984775 -5.01845 -0.7319 -6.925425ZM13.233575 22.211875c-1.029375 0.001625 -2.0265 -0.359175 -2.816475 -1.019125l0.13895 -0.07875 4.678725 -2.7007c0.236875 -0.138925 0.383 -0.39245 0.384475 -0.66705V11.149725l1.978025 1.1442c0.0198 0.0101 0.033575 0.029025 0.037075 0.05095v5.466225c-0.0051 2.42835 -1.9724 4.395675 -4.400775 4.400775ZM3.77425 18.172425c-0.516225 -0.8914 -0.701575 -1.936275 -0.52345 -2.950825l0.13895 0.083375 4.68335 2.700675c0.235975 0.138475 0.528375 0.138475 0.76435 0l5.721 -3.29825v2.283775c-0.001075 0.02395 -0.013025 0.046125 -0.032425 0.0602L9.787075 19.7845c-2.105825 1.21315 -4.7963 0.491825 -6.012825 -1.612075Zm-1.232225 -10.19125c0.519825 -0.89715 1.3403 -1.581425 2.3162 -1.9317v5.55885c-0.003575 0.27355 0.141975 0.527375 0.37985 0.66245l5.6932 3.28435 -1.978025 1.1442c-0.021725 0.011525 -0.04775 0.011525 -0.069475 0L4.1541 13.97085c-2.1016975 -1.2182 -2.8224825 -3.90665 -1.612075 -6.012825v0.02315Zm16.250425 3.7754 -5.71175 -3.3168 1.9734 -1.13955c0.021725 -0.01155 0.047775 -0.01155 0.0695 0L19.85325 10.033325c1.476175 0.851825 2.327775 2.479375 2.186 4.177775 -0.141775 1.6984 -1.25145 3.162225 -2.848425 3.7575V12.40975c-0.0083 -0.27275 -0.159675 -0.52095 -0.398375 -0.653175Zm1.96875 -2.9601 -0.138975 -0.083375L15.94815 5.98925c-0.2374 -0.1393 -0.531575 -0.1393 -0.768975 0L9.462825 9.2875v-2.28375c-0.002475 -0.02365 0.008175 -0.046775 0.0278 -0.060225l4.72965 -2.728475c1.479775 -0.852475 3.31895 -0.772925 4.719575 0.20415 1.40065 0.977075 2.1104 2.675625 1.82135 4.35875v0.018525ZM8.383475 12.845175l-1.978025 -1.13955c-0.02 -0.012125 -0.033575 -0.032475 -0.037075 -0.0556V6.1977c0.002275 -1.707425 0.990925 -3.2598 2.53725 -3.983845 1.5463 -0.7240575 3.37175 -0.489395 4.68465 0.60222l-0.138975 0.07875L8.7726 5.5955c-0.236875 0.13895 -0.383 0.39245 -0.3845 0.667075l-0.004625 6.5826Zm1.0747 -2.316175 2.547825 -1.468475 2.55245 1.468475v2.936925l-2.543175 1.46845 -2.55245 -1.46845 -0.00465 -2.936925Z",
    },
    {
        name: "xAI",
        color: "#000000",
        path: "M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z",
    },
];

const simpleIconProviders: BrandIcon[] = [
    { si: siGooglegemini, name: "Gemini" },
    { si: siOllama, name: "Ollama" },
    { si: siOpenrouter, name: "OpenRouter" },
    { si: siCloudflareworkers, name: "Workers AI" },
].map(({ si, name }: { si: { hex: string; path: string }; name: string }) => ({
    name,
    color: `#${si.hex}`,
    path: si.path,
}));

const providers: BrandIcon[] = [
    ...manualProviders,
    {
        name: "Anthropic",
        color: "#ffffff",
        path: siAnthropic.path,
    },
    ...simpleIconProviders,
];
function FrameworkLogosSmall() {
    return (
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            {frameworks.map((fw) => (
                <div className="flex items-center gap-1.5 opacity-55" key={fw.name}>
                    <BrandLogo brand={fw} size={12} />
                    <span className="hidden text-[9.5px] font-[300] text-[color:color-mix(in_srgb,var(--foreground)_38%,transparent)] sm:inline">
                        {fw.name}
                    </span>
                </div>
            ))}
        </div>
    );
}
function ProviderLogosSmall() {
    return (
        <div className="flex flex-wrap items-center gap-2.5">
            {providers.map((p) => (
                <div className="opacity-50" key={p.name}>
                    <BrandLogo brand={p} size={14} />
                </div>
            ))}
            <span className="inline-flex h-4 items-center border border-dashed border-[color:color-mix(in_srgb,var(--foreground)_12%,transparent)] px-1.5 text-[9.5px] font-[300] text-[color:color-mix(in_srgb,var(--foreground)_30%,transparent)]">
                +more
            </span>
        </div>
    );
}
const pluginNames = [
    "rateLimit",
    "logging",
    "sandbox",
    "ipAllowlist",
    "guards",
    "hooks",
    "endpoints",
    "middleware",
];

function PluginMarquee() {
    const pills = pluginNames.map((name) => (
        <span
            className="inline-flex shrink-0 items-center border border-dashed border-[color:color-mix(in_srgb,var(--foreground)_12%,transparent)] px-2 py-[1px] font-mono text-[9.5px] font-[300] text-[color:color-mix(in_srgb,var(--foreground)_34%,transparent)]"
            key={name}
        >
            {name}
        </span>
    ));

    return (
        <div
            className="relative overflow-hidden"
            style={{
                maskImage:
                    "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
                WebkitMaskImage:
                    "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
            }}
        >
            <div className="plugin-marquee-track gap-2">
                {pills}
                {pills}
            </div>
        </div>
    );
}
const features: GridFeature[] = [
    {
        title: "Composable Agents",
        description:
            "Build larger agent systems from smaller agents, tools, and shared runtime parts.",
        icon: Blocks,
    },
    {
        title: "Multi-Provider",
        description: "Swap models with one line. Same API across supported providers.",
        icon: Layers,
        extra: <ProviderLogosSmall />,
    },
    {
        title: "Plugins",
        description:
            "Add app-level guards, hooks, middleware, endpoints, and shared behavior with plugins.",
        icon: Plug,
        extra: <PluginMarquee />,
    },
    {
        title: "Framework Agnostic",
        description:
            "Use Better Agent with your stack instead of building around a fixed app framework.",
        icon: GitFork,
        extra: <FrameworkLogosSmall />,
    },
    {
        title: "AG-UI Events",
        description:
            "Stream standard AG-UI events for messages, tools, approvals, interrupts, and final results.",
        icon: Activity,
    },
    {
        title: "Durable Runs",
        description:
            "Resume interrupted runs, replay streams, and continue threads across requests.",
        icon: RefreshCcw,
    },
    {
        title: "Human in the Loop",
        description:
            "Pause before sensitive tools run, then approve, reject, or resume from the client.",
        icon: Route,
    },
    {
        title: "First-Class Auth",
        description:
            "Resolve request identity once, then use it across access rules, memory, plugins, and tools.",
        icon: ShieldCheck,
    },
    {
        title: "Tools Everywhere",
        description:
            "Call server tools, pause for client tools, connect MCP, or pass through hosted provider tools.",
        icon: Wrench,
    },
];
export default function FeaturesSection() {
    return (
        <section className="relative mx-auto w-full max-w-[76rem] px-5 pt-12 pb-12 sm:px-8 sm:pt-14 sm:pb-14 md:pt-16 md:pb-16">
            <div className="flex items-center gap-3">
                <p className="text-[10.5px] font-[330] tracking-[0.08em] text-[color:color-mix(in_srgb,var(--foreground)_34%,transparent)] uppercase">
                    Features
                </p>
                <div className="h-px flex-1 bg-[color:color-mix(in_srgb,var(--foreground)_6%,transparent)]" />
            </div>
            <div className="-m-px mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {features.map((feature, i) => (
                    <GridFeatureCard feature={feature} index={i} key={feature.title} />
                ))}
            </div>
            <div className="mt-9 flex flex-col items-center gap-4 sm:mt-10">
                <p className="text-[10px] font-[300] tracking-[0.1em] text-[color:color-mix(in_srgb,var(--foreground)_28%,transparent)] uppercase">
                    Works with
                </p>
                <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
                    {runtimes.map((b) => (
                        <div
                            className="flex items-center gap-1.5 opacity-42 transition-opacity hover:opacity-70"
                            key={b.name}
                        >
                            <BrandLogo brand={b} size={16} />
                            <span className="hidden text-[11px] font-[300] text-[color:color-mix(in_srgb,var(--foreground)_42%,transparent)] sm:inline">
                                {b.name}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
