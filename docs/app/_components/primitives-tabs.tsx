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
        <div className="mx-auto max-w-3xl">
            <div className="primitive-scrollbar-hidden overflow-x-auto border-b border-[color:var(--showcase-shell-border)]">
                <div
                    className="flex min-w-max"
                    aria-label="Better Agent core primitives"
                    role="tablist"
                >
                    {tabs.map((item, index) => (
                        <button
                            aria-selected={index === activeTab}
                            className={`font-mono cursor-pointer border-b-[1.5px] px-4 py-2.5 text-[12px] tracking-[-0.01em] transition-colors sm:px-5 ${
                                index === activeTab
                                    ? "border-[color:var(--foreground)] text-[color:var(--foreground)]"
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
