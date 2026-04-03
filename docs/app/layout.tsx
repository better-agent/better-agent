import { source } from "@/lib/source";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Providers from "./_components/providers";
import SiteHeader from "./_components/site-header";
import "./globals.css";

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
    weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
    weight: ["400", "500", "600", "700"],
});

const BASE_URL = "https://better-agent.com";

export const metadata: Metadata = {
    metadataBase: new URL(BASE_URL),
    icons: {
        icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
        shortcut: [{ url: "/icon.svg", type: "image/svg+xml" }],
        apple: [{ url: "/apple-icon.svg", type: "image/svg+xml" }],
    },
    title: {
        default: "Better Agent",
        template: "%s | Better Agent",
    },
    description: "The better way to build AI agents in TypeScript.",
    keywords: [
        "AI agents",
        "TypeScript",
        "agent framework",
        "typed agents",
        "durable agents",
        "composable agents",
        "agent tools",
        "structured output",
        "human in the loop",
        "agent framework typescript",
    ],
    authors: [{ name: "Better Agent" }],
    creator: "Better Agent",
    publisher: "Better Agent",
    robots: {
        index: true,
        follow: true,
        googleBot: {
            index: true,
            follow: true,
            "max-video-preview": -1,
            "max-image-preview": "large",
            "max-snippet": -1,
        },
    },
    openGraph: {
        type: "website",
        locale: "en_US",
        url: BASE_URL,
        siteName: "Better Agent",
        title: "Better Agent",
        description: "The better way to build AI agents in TypeScript.",
        images: [
            {
                url: `${BASE_URL}/og.png`,
                width: 1200,
                height: 630,
                alt: "Better Agent",
            },
        ],
    },
    twitter: {
        card: "summary_large_image",
        title: "Better Agent",
        description: "The better way to build AI agents in TypeScript.",
        creator: "@probiruk",
        images: [`${BASE_URL}/og.png`],
    },
    alternates: {
        canonical: BASE_URL,
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
                <Providers>
                    <div className="relative isolate flex min-h-svh flex-col overflow-x-clip [--header-height:2.9rem]">
                        <SiteHeader pageTree={source.pageTree} />
                        {children}
                    </div>
                </Providers>
                <Analytics />
                <SpeedInsights />
            </body>
        </html>
    );
}
