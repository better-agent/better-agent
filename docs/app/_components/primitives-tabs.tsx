"use client";

import { type ReactNode, useState } from "react";

type PrimitiveTabMeta = {
    label: string;
};

type PrimitivesTabsProps = {
    panels: ReactNode[];
    tabs: PrimitiveTabMeta[];
};

export default function PrimitivesTabs({ panels, tabs }: PrimitivesTabsProps) {
    const [activeTab, setActiveTab] = useState(0);

    return (
        <div className="mx-auto grid max-w-5xl gap-4 md:grid-cols-[10rem_minmax(0,1fr)] md:gap-6">
            <div className="primitive-scrollbar-hidden overflow-x-auto border-b border-[color:var(--showcase-shell-border)] md:overflow-visible md:border-r md:border-b-0">
                <div
                    className="flex min-w-max md:min-w-0 md:flex-col"
                    aria-label="Better Agent core primitives"
                    role="tablist"
                >
                    {tabs.map((item, index) => (
                        <button
                            aria-selected={index === activeTab}
                            className={`font-mono cursor-pointer border-b-[1.5px] px-4 py-2.5 text-left text-[12px] font-[330] tracking-[-0.005em] transition-colors sm:px-5 md:border-r-[1.5px] md:border-b-0 md:px-0 md:py-3 md:pr-5 ${
                                index === activeTab
                                    ? "border-[color:color-mix(in_srgb,var(--foreground)_82%,transparent)] text-[color:color-mix(in_srgb,var(--foreground)_82%,transparent)]"
                                    : "border-transparent text-[color:color-mix(in_srgb,var(--foreground)_38%,transparent)] hover:text-[color:color-mix(in_srgb,var(--foreground)_60%,transparent)]"
                            }`}
                            id={`primitive-tab-${index}`}
                            key={item.label}
                            onClick={() => setActiveTab(index)}
                            role="tab"
                            tabIndex={index === activeTab ? 0 : -1}
                            type="button"
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
            </div>

            <div aria-labelledby={`primitive-tab-${activeTab}`} role="tabpanel">
                {panels[activeTab]}
            </div>
        </div>
    );
}
