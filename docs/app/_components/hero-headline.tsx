"use client";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";

const heroPhrases = [
    {
        text: "compose agents",
        gradientFrom: "#0ea5e9",
        gradientTo: "#38bdf8",
    },
    {
        text: "build typed agents",
        gradientFrom: "#22c55e",
        gradientTo: "#4ade80",
    },
    {
        text: "build durable agents",
        gradientFrom: "#ec4899",
        gradientTo: "#f472b6",
    },
] as const;

const ROTATION_MS = 3600;

export default function HeroHeadline() {
    const [activeIndex, setActiveIndex] = useState(0);

    useEffect(() => {
        const intervalId = window.setInterval(() => {
            setActiveIndex((current) => (current + 1) % heroPhrases.length);
        }, ROTATION_MS);
        return () => window.clearInterval(intervalId);
    }, []);

    const activePhrase = heroPhrases[activeIndex];

    return (
        <h1 className="m-0 flex flex-col items-center gap-[0.05em] text-balance text-[clamp(2.18rem,5.8vw,2.66rem)] font-semibold leading-[1.09] tracking-[-0.025em] md:gap-[0.035em] md:text-[clamp(2.04rem,3.85vw,2.9rem)] md:leading-[1.05]">
            <span className="block text-[color:color-mix(in_srgb,var(--foreground)_97%,white_3%)]">
                The better way to
            </span>
            <span className="block overflow-visible pb-[0.15em]">
                <span
                    className="motion-safe:animate-[hero-headline-snap-down_560ms_cubic-bezier(0.22,1,0.36,1)] block pb-[0.06em] leading-[1.1] bg-clip-text text-transparent will-change-transform"
                    key={activePhrase.text}
                    style={
                        {
                            backgroundImage: `linear-gradient(90deg, ${activePhrase.gradientFrom} 0%, ${activePhrase.gradientTo} 100%)`,
                            WebkitBackgroundClip: "text",
                            backgroundClip: "text",
                        } as CSSProperties
                    }
                >
                    {activePhrase.text}
                </span>
            </span>
            <span className="block text-[color:color-mix(in_srgb,var(--foreground)_97%,white_3%)]">
                in{" "}
                <span className="inline-block bg-[var(--hero-selection-bg)] px-[0.31em] py-[0.07em] text-[var(--hero-selection-fg)] [box-decoration-break:clone] [-webkit-box-decoration-break:clone] [clip-path:polygon(0.18em_0,100%_0,calc(100%-0.18em)_100%,0_100%)]">
                    TypeScript
                </span>
            </span>
        </h1>
    );
}
