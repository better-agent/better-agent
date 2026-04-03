import { cookbookSource } from "@/lib/cookbook-source";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import type { ReactNode } from "react";

export default function CookbookDocsLayout({ children }: { children: ReactNode }) {
    return (
        <DocsLayout
            tree={cookbookSource.pageTree}
            searchToggle={{ enabled: false }}
            themeSwitch={{ enabled: false }}
            i18n={false}
            links={[]}
            sidebar={{
                enabled: false,
            }}
            nav={{
                enabled: false,
            }}
            containerProps={{
                className: "cookbook-shell",
                style: {
                    "--fd-docs-height": "calc(100svh - var(--header-offset))",
                    "--fd-docs-row-1": "0px",
                } as React.CSSProperties,
            }}
        >
            {children}
        </DocsLayout>
    );
}
