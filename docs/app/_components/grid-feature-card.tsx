"use client";

import type { LucideIcon } from "lucide-react";
import type React from "react";

export type GridFeature = {
    title: string;
    icon: LucideIcon | React.ComponentType<React.SVGProps<SVGSVGElement>>;
    description: string;
    extra?: React.ReactNode;
};

type GridFeatureCardProps = {
    feature: GridFeature;
    index: number;
};

export function GridFeatureCard({ feature, index }: GridFeatureCardProps) {
    const num = String(index + 1).padStart(2, "0");
    const Icon = feature.icon;

    return (
        <div className="group relative flex flex-col gap-4 border border-[color:var(--border)] p-6 sm:p-7 transition-colors duration-200">
            <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] tracking-[0.04em] text-[color:color-mix(in_srgb,var(--foreground)_28%,transparent)]">
                    {num}
                </span>
                <span className="text-[10.5px] font-semibold tracking-[0.08em] text-[color:color-mix(in_srgb,var(--foreground)_36%,transparent)] uppercase">
                    {feature.title}
                </span>
            </div>
            <h3 className="text-[15px] font-medium leading-snug text-[color:var(--foreground)]">
                {feature.description.replace(/\.$/, "")}.
            </h3>
            {feature.extra && <div className="mt-auto">{feature.extra}</div>}
            {!feature.extra && (
                <Icon
                    aria-hidden
                    className="mt-auto size-5 text-[color:color-mix(in_srgb,var(--foreground)_32%,transparent)]"
                    strokeWidth={1.5}
                />
            )}
        </div>
    );
}
