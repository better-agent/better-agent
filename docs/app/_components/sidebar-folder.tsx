"use client";

import Link from "fumadocs-core/link";
import type { Folder } from "fumadocs-core/page-tree";
import { useTreePath } from "fumadocs-ui/contexts/tree";
import { type ReactNode, createContext, useContext } from "react";

type SidebarFolderProps = {
    item: Folder;
    children: ReactNode;
};

const DepthContext = createContext(0);

function formatSectionName(name: string) {
    const formatted = name.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
    if (formatted !== "Providers") return formatted;

    return (
        <>
            <span>Providers</span>
            <span className="docs-soon-badge">(more soon!)</span>
        </>
    );
}

export default function SidebarFolder({ item, children }: SidebarFolderProps) {
    const depth = useContext(DepthContext);
    const treePath = useTreePath();
    const isActive = treePath.includes(item);
    const isSubSection = depth > 0;

    const sectionClass = isSubSection
        ? "docs-sidebar-folder docs-sidebar-subsection"
        : "docs-sidebar-folder docs-sidebar-section";

    const label = (
        <div
            className={
                isSubSection ? "docs-sidebar-subsection__label" : "docs-sidebar-section__label"
            }
        >
            {item.icon ?? null}
            {formatSectionName(String(item.name))}
        </div>
    );

    return (
        <DepthContext.Provider value={depth + 1}>
            <div className={sectionClass} data-state="open">
                {item.index ? (
                    <Link
                        className={
                            isSubSection
                                ? "docs-sidebar-subsection__label-link"
                                : "docs-sidebar-section__label-link"
                        }
                        data-active={isActive ? "true" : undefined}
                        href={item.index.url}
                    >
                        {label}
                    </Link>
                ) : (
                    label
                )}
                <div aria-hidden={false} className="docs-sidebar-folder__content" data-open="true">
                    <div className="docs-sidebar-folder__content-inner">{children}</div>
                </div>
            </div>
        </DepthContext.Provider>
    );
}
