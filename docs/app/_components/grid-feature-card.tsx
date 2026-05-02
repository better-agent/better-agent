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
        <div className="group relative flex min-h-[9.25rem] flex-col gap-3 border border-[color:var(--ba-border-subtle)] px-4 py-4 transition-colors duration-200 hover:border-[color:var(--ba-border)] sm:min-h-[10rem] sm:px-5 sm:py-5">
            <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] font-[330] tracking-[0.045em] text-[color:color-mix(in_srgb,var(--foreground)_24%,transparent)]">
                    {num}
                </span>
                <span className="text-[10px] font-[330] tracking-[0.075em] text-[color:color-mix(in_srgb,var(--foreground)_34%,transparent)] uppercase">
                    {feature.title}
                </span>
            </div>
            <h3 className="text-[13.5px] font-[330] leading-[1.45] text-[color:color-mix(in_srgb,var(--foreground)_68%,transparent)] sm:text-[14px]">
                {feature.description.replace(/\.$/, "")}.
            </h3>
            {feature.extra && <div className="mt-auto">{feature.extra}</div>}
            {!feature.extra && (
                <Icon
                    aria-hidden
                    className="mt-auto size-4 text-[color:color-mix(in_srgb,var(--foreground)_28%,transparent)]"
                    strokeWidth={1.35}
                />
            )}
        </div>
    );
}
