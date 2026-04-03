import SidebarBanner from "@/app/_components/sidebar-banner";
import SidebarFolder from "@/app/_components/sidebar-folder";
import { source } from "@/lib/source";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import type { ReactNode } from "react";

export default function Layout({ children }: { children: ReactNode }) {
    return (
        <DocsLayout
            tree={source.pageTree}
            searchToggle={{
                enabled: true,
            }}
            themeSwitch={{ enabled: false }}
            i18n={false}
            links={[]}
            sidebar={{
                footer: null,
                collapsible: false,
                banner: <SidebarBanner />,
                components: {
                    Folder: SidebarFolder,
                },
            }}
            nav={{
                enabled: false,
            }}
            containerProps={{
                className: "docs-shell min-h-[calc(100svh-var(--header-offset))]",
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
