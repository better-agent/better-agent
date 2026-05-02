import { RootProvider } from "@farming-labs/theme";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";
import SiteHeader from "./site-header";
import "./globals.css";

const BASE_URL = "https://better-agent.com";
const HOME_OG_IMAGE = "/api/og?variant=home";

export const metadata: Metadata = {
    metadataBase: new URL(BASE_URL),
    title: {
        default: "Better Agent",
        template: "%s - Better Agent",
    },
    description:
        "A TypeScript framework for building typed, event-driven, framework-agnostic agent apps.",
    keywords: [
        "AI agents",
        "TypeScript",
        "agent framework",
        "typed agents",
        "durable agents",
        "composable agents",
        "structured output",
        "human in the loop",
    ],
    applicationName: "Better Agent",
    alternates: {
        canonical: "/",
    },
    icons: {
        icon: [
            { url: "/favicon.ico", sizes: "any" },
            { url: "/icon.svg", type: "image/svg+xml" },
        ],
        apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
    },
    openGraph: {
        type: "website",
        locale: "en_US",
        url: BASE_URL,
        siteName: "Better Agent",
        title: "Better Agent",
        description:
            "A TypeScript framework for building typed, event-driven, framework-agnostic agent apps.",
        images: [
            {
                url: HOME_OG_IMAGE,
                width: 1200,
                height: 630,
                alt: "Better Agent",
            },
        ],
    },
    twitter: {
        card: "summary_large_image",
        title: "Better Agent",
        description:
            "A TypeScript framework for building typed, event-driven, framework-agnostic agent apps.",
        images: [HOME_OG_IMAGE],
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html
            lang="en"
            data-scroll-behavior="smooth"
            suppressHydrationWarning
            className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
        >
            <body className="min-h-full flex flex-col pt-[var(--header-height)] [--header-height:3rem]">
                <RootProvider theme={{ defaultTheme: "dark" }}>
                    <SiteHeader />
                    {children}
                </RootProvider>
                <Analytics />
                <SpeedInsights />
            </body>
        </html>
    );
}
