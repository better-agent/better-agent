import { defineDocs } from "@farming-labs/docs";
import { pixelBorder } from "@farming-labs/theme/pixel-border";
import {
    Activity,
    Blocks,
    BookOpen,
    Bot,
    Boxes,
    Braces,
    Brain,
    Code2,
    Database,
    FileCode2,
    Network,
    Package,
    Plug,
    Puzzle,
    RefreshCcw,
    Route,
    Server,
    ShieldCheck,
    Terminal,
    Users,
    Workflow,
    Wrench,
} from "lucide-react";
import type { ReactNode } from "react";
import {
    siAnthropic,
    siAstro,
    siCloudflare,
    siDrizzle,
    siExpress,
    siFastify,
    siGooglegemini,
    siHono,
    siNestjs,
    siNextdotjs,
    siNuxt,
    siOllama,
    siOpenrouter,
    siPrisma,
    siRedis,
    siRemix,
    siSolid,
    siSvelte,
    siTanstack,
    siVercel,
} from "simple-icons";
import { SidebarReleaseBanner } from "./app/_components/sidebar-release-banner";

const icon = (node: ReactNode) => (
    <span className="flex size-4 shrink-0 items-center justify-center text-white/70 [&_svg]:size-4">
        {node}
    </span>
);

const brandIcon = (path: string, title: string) =>
    icon(
        <svg aria-hidden="true" fill="currentColor" viewBox="0 0 24 24" role="img">
            <title>{title}</title>
            <path d={path} />
        </svg>,
    );

const xaiIcon = brandIcon(
    "M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z",
    "xAI",
);

const elysiaIcon = icon(
    <svg aria-hidden="true" fill="none" role="img" viewBox="0 0 512 512">
        <title>Elysia</title>
        <path
            clipRule="evenodd"
            d="M424.404 470.816C478.089 423.889 512 354.905 512 278C512 136.615 397.385 22 256 22C114.615 22 0 136.615 0 278C0 352.658 31.9583 419.851 82.9409 466.646L83.1767 465L419.144 355L424.404 470.816Z"
            fill="#333333"
            fillRule="evenodd"
        />
        <path
            d="M189.915 52.7412L144.5 46L151.303 43.9069C155.402 42.6455 159.248 40.6719 162.662 38.0765L163.73 37.2654C167.845 34.1375 171.12 30.0364 173.259 25.3304C174.414 22.7883 175.224 20.1027 175.665 17.3454L176.173 14.1698C176.72 10.7473 176.692 7.25741 176.09 3.84416C175.834 2.39429 177.279 1.23239 178.64 1.79296L180.498 2.55815C182.829 3.51798 185.084 4.65434 187.242 5.95732L194.965 10.6205C205.229 16.8174 214.226 24.9023 221.48 34.4477L226.616 41.2051C228.529 43.7228 230.783 45.9625 233.313 47.8599C236.088 49.9411 239.164 51.5874 242.435 52.7418L246 54L227.274 54.749C214.785 55.2486 202.278 54.5764 189.915 52.7412Z"
            fill="#CCCCCC"
        />
        <path
            d="M178.321 93.006L191.79 68.3844C191.922 68.143 191.93 67.8528 191.812 67.6042L187.22 57.9361C184.337 51.8673 178.219 48 171.5 48L170.23 47.9562C161.437 47.653 152.704 46.3829 144.188 44.169L142.504 43.731C135.521 41.9153 128.746 39.3732 122.293 36.1463L119.446 34.723C115.159 32.5797 111.099 30.012 107.325 27.0584L103.55 24.1043C102.428 23.2265 100.803 23.4506 99.9606 24.5992C97.3651 28.1384 95.7379 32.2935 95.2395 36.6541L94.5535 42.6571C94.1854 45.8774 94.1446 49.1267 94.4316 52.3552L96.1031 71.1595C97.3467 85.1501 102.175 98.584 110.123 110.165L111.825 112.645C114.267 116.203 117.113 119.466 120.306 122.369C120.756 122.778 121.329 123.03 121.936 123.084C145.029 125.156 167.194 113.348 178.321 93.006Z"
            fill="#CCCCCC"
        />
        <path
            d="M127.378 123.538L143.376 116.613C150.438 113.557 152.588 104.577 147.676 98.6533C143.683 93.8378 136.58 93.0803 131.661 96.9453L127.867 99.9256C126.958 100.64 126.127 101.448 125.387 102.336L116.263 113.284C114.982 114.822 115.084 117.084 116.5 118.5L119.318 121.721C119.77 122.237 120.296 122.685 120.878 123.049C122.833 124.271 125.263 124.453 127.378 123.538Z"
            fill="#EDEDED"
        />
        <path
            d="M147.988 44.8437L147.5 45L148.962 45.4651C155.294 47.4798 161.861 48.66 168.498 48.9761C168.83 48.9919 169.163 48.9534 169.483 48.8619L172.5 48L174 47.5L164.419 45.4172C163.158 45.1431 161.982 44.5687 160.991 43.7426C160.218 43.0981 160.223 41.9084 161.002 41.2708L162.423 40.1084C164.12 38.7197 165.493 36.976 166.444 35C160.934 39.3642 154.682 42.6988 147.988 44.8437Z"
            fill="#B2B2B2"
        />
        <path
            d="M202.776 219.428L72.2905 452.693C71.643 453.851 70.0687 454.069 69.1308 453.131L66.5 450.5L55.5 438L48.4888 428.927C41.8407 420.323 35.9052 411.192 30.7414 401.624L29.7434 399.775C24.2581 389.611 19.6635 378.991 16.0112 368.034L12.5 357.5C7.22519 338.379 6.01447 318.365 8.94583 298.747L9.06961 297.919C10.354 289.323 12.4034 280.86 15.1935 272.629L21 255.5L25.3334 246.385C32.0537 232.249 41.3193 219.472 52.6669 208.691L58.1719 203.462C69.5529 192.65 83.3937 184.769 98.5 180.5C94.967 181.498 91.3608 182.216 87.7149 182.647L80.5 183.5L75 184L69 185L63 185.561L59 186L56.1186 186.18C55.1927 186.238 54.7576 185.057 55.4998 184.5L55.5002 184.5L59.5273 182.57C72.5066 176.351 83.1766 166.172 90 153.5L94.4475 146.562C99.7511 138.288 106.807 131.28 115.116 126.032L116.833 124.948C119.935 122.989 123.246 121.384 126.705 120.163L142.446 114.607C145.348 113.583 147.69 111.39 148.903 108.561L149.143 108C149.705 106.687 149.932 105.255 149.803 103.833C149.608 101.689 148.616 99.6966 147.023 98.2485L144.256 95.7328C144.086 95.5779 143.93 95.4073 143.792 95.2232L126 71.5L111.803 51.9315C108.994 48.0592 107.359 43.4599 107.094 38.6832C107.051 37.9263 107.836 37.4015 108.52 37.7295L123.881 45.1028C137.174 51.4834 152.33 52.825 166.537 48.8786C169.84 47.9612 173.214 47.3242 176.624 46.9745L183.675 46.2513C201.406 44.4328 219.32 45.9054 236.516 50.5953L238 51L254.798 57.0472C275.869 64.6329 292.567 81.0571 300.5 102L304.022 115.734C305.004 119.567 306.392 123.285 308.162 126.824C312.321 135.142 318.495 142.289 326.121 147.613L335.084 153.87C339.023 156.62 343.157 159.078 347.453 161.227L367.289 171.145C368.178 171.589 368.444 172.732 367.843 173.523C362.372 180.721 355.148 186.395 346.859 190.005L335.371 195.008C330.797 197 326.081 198.65 321.262 199.945L312.822 202.212C300.992 205.39 288.796 207 276.546 207H256.333C252.148 207 248.001 206.213 244.108 204.679C228.581 198.562 210.923 204.863 202.776 219.428Z"
            fill="white"
        />
        <path
            d="M271.185 135.316L279.987 135.418C281.182 135.432 281.452 133.748 280.312 133.388C278.441 132.797 276.623 132.048 274.879 131.15L268.008 127.61C263.35 125.211 258.969 122.308 254.944 118.953L253.592 117.827C250.54 115.283 247.77 112.418 245.33 109.282L243.768 107.273C243.234 106.586 242.134 107.005 242.192 107.873C243.212 123.186 255.839 135.138 271.185 135.316Z"
            fill="#666666"
        />
        <path
            d="M82.2231 456.395L231.313 323.4C245.367 310.863 257.58 296.403 267.59 280.45L268.5 279C273.404 269.192 275.497 258.217 274.547 247.293L273.24 232.258C272.436 223.009 268.618 214.28 262.373 207.41C262.131 207.144 261.81 206.961 261.457 206.889L237.5 202C220.117 196.752 201.688 195.995 183.933 199.8L183 200L169.06 203.259C128.405 212.763 92.5742 236.685 68.2116 270.592L67.597 271.447C60.8846 280.789 55.1822 290.817 50.5856 301.362L49.765 303.245C38.1544 329.881 34.2409 359.238 38.4684 387.985L39.8511 397.387C41.2751 407.07 44.1931 416.474 48.5011 425.262C52.4798 433.379 57.6014 440.883 63.7095 447.547L71.3177 455.847C74.1911 458.981 79.0498 459.225 82.2231 456.395Z"
            fill="#CCCCCC"
        />
        <path
            d="M212.749 278.858L212.267 279.133C199.686 286.322 192.918 299.892 193.58 314.367C193.768 318.484 197.893 322.255 201.858 321.132L209.163 319.062C218.607 316.386 227.353 311.681 234.789 305.274L256 287L262.292 282.343C298.871 255.269 344.833 244.113 389.754 251.405C391.14 251.63 391.184 253.607 389.81 253.894L384.5 255L382.093 255.842C377.15 257.572 372.856 260.776 369.79 265.022C369.214 265.819 369.982 266.89 370.922 266.601L372.663 266.065C382.467 263.049 392.751 261.904 402.978 262.691L407 263C428.843 263.95 449.114 274.626 462.254 292.1L467.179 298.65C481.776 318.063 487.953 342.53 484.319 366.545L482.421 379.087C479.837 396.163 473.618 412.486 464.184 426.952L463.5 428L453 442L441.5 455L430.965 465.114C421.346 474.348 410.827 482.597 399.567 489.738L396 492L389.175 495.25C387.417 496.087 385.95 493.678 387.5 492.5L397 483.5L398.953 481.449C404.232 475.906 408.027 469.12 409.986 461.721L410.889 458.309C411.295 456.776 411.5 455.174 411.5 453.588C411.5 444.909 405.354 437.298 396.836 435.631C391.554 434.597 386.085 435.962 381.907 439.356L372.5 447L355.894 460.587C344.995 469.504 333.185 477.245 320.66 483.682L303.5 492.5L274.5 503.5L268.412 505.16C257.822 508.049 247.012 510.06 236.092 511.174L228 512H202L167.5 508.25L148.832 504.21C138.985 502.079 129.456 498.682 120.482 494.103C113.181 490.378 106.293 485.894 99.931 480.725L85.5 469C68.005 455.64 57.0449 435.448 55.3749 413.498L54.5 402L55.5295 385.822C57.134 360.608 66.7911 336.576 83.0792 317.263C89.6652 309.454 97.2376 302.534 105.606 296.675L108.677 294.526C121.458 285.579 135.72 278.961 150.805 274.976L160.947 272.297C174.135 268.813 187.952 268.445 201.307 271.22L211.887 273.418C214.542 273.97 215.103 277.513 212.749 278.858Z"
            fill="#5E5E5E"
        />
    </svg>,
);

const kyselyIcon = icon(
    <svg aria-hidden="true" fill="none" role="img" viewBox="0 0 132 132">
        <title>Kysely</title>
        <rect fill="currentColor" height="128" opacity="0.86" rx="16" width="128" x="2" y="2" />
        <path
            d="M41.2983 109V23.9091H46.4918V73.31H47.0735L91.9457 23.9091H98.8427L61.9062 64.1694L98.5103 109H92.0288L58.5824 67.9087L46.4918 81.2873V109H41.2983Z"
            fill="var(--ba-bg)"
        />
        <rect height="128" rx="16" stroke="currentColor" strokeWidth="4" width="128" x="2" y="2" />
    </svg>,
);

export default defineDocs({
    entry: "docs",
    theme: pixelBorder({
        ui: {
            colors: {
                primary: "#e8edf3",
                background: "#050505",
                muted: "#101113",
                border: "#1a1c20",
            },
            sidebar: { style: "floating" },
            layout: {
                contentWidth: 920,
                sidebarWidth: 286,
                toc: { enabled: true, depth: 3, style: "directional" },
            },
        },
    }),
    mcp: {
        enabled: true,
        name: "better-agent",
        tools: {
            listPages: true,
            readPage: true,
            searchDocs: true,
            getNavigation: true,
        },
    },
    nav: {
        title: "",
        url: "/",
    },
    lastUpdated: false,
    metadata: {
        titleTemplate: "%s - Better Agent",
        description:
            "A TypeScript framework for building typed, event-driven, framework-agnostic agent apps.",
    },
    og: {
        enabled: true,
        type: "dynamic",
        endpoint: "/api/og",
    },
    breadcrumb: { enabled: true },
    pageActions: {
        alignment: "right",
        copyMarkdown: { enabled: true },
        openDocs: {
            enabled: true,
            providers: [
                {
                    name: "ChatGPT",
                    icon: (
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            role="img"
                        >
                            <title>ChatGPT</title>
                            <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364l2.0201-1.1638a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.4092-.6813zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0974-2.3616l2.603-1.5018 2.6032 1.5018v3.0036l-2.6032 1.5018-2.603-1.5018z" />
                        </svg>
                    ),
                    urlTemplate: "https://chatgpt.com/?q=Read+this+documentation:+{url}",
                },
                {
                    name: "Claude",
                    icon: (
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            role="img"
                        >
                            <title>Claude</title>
                            <path d="M4.709 15.955l4.397-10.985c.245-.648.245-.648.9-.648h2.756c.649 0 .649 0 .9.648l4.397 10.985c.232.569.232.569-.363.569h-2.392c-.636 0-.636 0-.874-.648l-.706-1.865H8.276l-.706 1.865c-.238.648-.238.648-.874.648H4.709c.245-.648-.363-.569-.363-.569z" />
                            <path d="M15.045 6.891L12.289 0H14.61c.655 0 .655 0 .9.648l4.398 10.985c.231.569.231.569-.364.569h-2.391c-.637 0-.637 0-.875-.648z" />
                        </svg>
                    ),
                    urlTemplate: "https://claude.ai/new?q=Read+this+documentation:+{url}",
                },
                {
                    name: "Cursor",
                    icon: (
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            role="img"
                        >
                            <title>Cursor</title>
                            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                        </svg>
                    ),
                    urlTemplate:
                        "https://cursor.com/link/prompt?text=Read+this+documentation:+{url}",
                },
            ],
        },
    },
    ordering: [
        { slug: "get-started" },
        {
            slug: "concepts",
            children: [
                { slug: "agent" },
                { slug: "tools" },
                { slug: "hil" },
                { slug: "mcp" },
                { slug: "structured-output" },
                { slug: "events" },
                { slug: "state" },
                { slug: "client" },
                { slug: "auth" },
                { slug: "memory" },
                { slug: "storage" },
                { slug: "plugins" },
                { slug: "errors" },
                { slug: "typescript" },
            ],
        },
        {
            slug: "providers",
            children: [
                { slug: "openai" },
                { slug: "anthropic" },
                { slug: "xai" },
                { slug: "gemini" },
                { slug: "openrouter" },
                { slug: "workers-ai" },
                { slug: "ollama" },
                { slug: "ai-sdk" },
            ],
        },
        {
            slug: "database",
            children: [
                { slug: "drizzle" },
                { slug: "kysely" },
                { slug: "prisma" },
                { slug: "redis" },
            ],
        },
        {
            slug: "integrations",
            children: [
                { slug: "nextjs" },
                { slug: "remix" },
                { slug: "astro" },
                { slug: "nuxt" },
                { slug: "sveltekit" },
                { slug: "solidstart" },
                { slug: "tanstack-start" },
                { slug: "express" },
                { slug: "hono" },
                { slug: "elysia" },
                { slug: "fastify" },
                { slug: "nestjs" },
            ],
        },
        {
            slug: "plugins",
            children: [
                { slug: "rate-limit" },
                { slug: "logging" },
                { slug: "ip-allowlist" },
                { slug: "sandbox" },
            ],
        },
    ],
    themeToggle: { enabled: false },
    icons: {
        book: icon(<BookOpen strokeWidth={1.5} />),
        blocks: icon(<Blocks strokeWidth={1.5} />),
        boxes: icon(<Boxes strokeWidth={1.5} />),
        wrench: icon(<Wrench strokeWidth={1.5} />),
        users: icon(<Users strokeWidth={1.5} />),
        server: icon(<Server strokeWidth={1.5} />),
        bot: icon(<Bot strokeWidth={1.5} />),
        brain: icon(<Brain strokeWidth={1.5} />),
        database: icon(<Database strokeWidth={1.5} />),
        activity: icon(<Activity strokeWidth={1.5} />),
        terminal: icon(<Terminal strokeWidth={1.5} />),
        code: icon(<Code2 strokeWidth={1.5} />),
        plug: icon(<Plug strokeWidth={1.5} />),
        shield: icon(<ShieldCheck strokeWidth={1.5} />),
        braces: icon(<Braces strokeWidth={1.5} />),
        route: icon(<Route strokeWidth={1.5} />),
        refresh: icon(<RefreshCcw strokeWidth={1.5} />),
        package: icon(<Package strokeWidth={1.5} />),
        puzzle: icon(<Puzzle strokeWidth={1.5} />),
        network: icon(<Network strokeWidth={1.5} />),
        filecode: icon(<FileCode2 strokeWidth={1.5} />),
        workflow: icon(<Workflow strokeWidth={1.5} />),
        openai: icon(
            <svg aria-hidden="true" fill="currentColor" viewBox="0 0 24 24" role="img">
                <title>OpenAI</title>
                <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364l2.0201-1.1638a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.4092-.6813zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0974-2.3616l2.603-1.5018 2.6032 1.5018v3.0036l-2.6032 1.5018-2.603-1.5018z" />
            </svg>,
        ),
        anthropic: brandIcon(siAnthropic.path, siAnthropic.title),
        xai: xaiIcon,
        gemini: brandIcon(siGooglegemini.path, siGooglegemini.title),
        openrouter: brandIcon(siOpenrouter.path, siOpenrouter.title),
        cloudflare: brandIcon(siCloudflare.path, siCloudflare.title),
        nextjs: brandIcon(siNextdotjs.path, siNextdotjs.title),
        remix: brandIcon(siRemix.path, siRemix.title),
        astro: brandIcon(siAstro.path, siAstro.title),
        nuxt: brandIcon(siNuxt.path, siNuxt.title),
        svelte: brandIcon(siSvelte.path, siSvelte.title),
        solid: brandIcon(siSolid.path, siSolid.title),
        tanstack: brandIcon(siTanstack.path, siTanstack.title),
        express: brandIcon(siExpress.path, siExpress.title),
        hono: brandIcon(siHono.path, siHono.title),
        fastify: brandIcon(siFastify.path, siFastify.title),
        elysia: elysiaIcon,
        nestjs: brandIcon(siNestjs.path, siNestjs.title),
        ollama: brandIcon(siOllama.path, siOllama.title),
        vercel: brandIcon(siVercel.path, siVercel.title),
        drizzle: brandIcon(siDrizzle.path, siDrizzle.title),
        prisma: brandIcon(siPrisma.path, siPrisma.title),
        kysely: kyselyIcon,
        redis: brandIcon(siRedis.path, siRedis.title),
    },
    sidebar: {
        collapsible: false,
        folderIndexBehavior: "toggle",
        banner: <SidebarReleaseBanner />,
    },
});
