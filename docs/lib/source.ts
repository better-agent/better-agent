import { docs } from "collections/server";
import type { Item, Root } from "fumadocs-core/page-tree";
import { loader } from "fumadocs-core/source";
import { type CSSProperties, createElement } from "react";
import { type DocsManifest, docsManifest } from "./source-manifest";

type RootEntry = Root["children"][number];
type TreeEntry = RootEntry | Item;
type FolderEntry = Extract<TreeEntry, { type: "folder" }>;
type FolderChildEntry = FolderEntry["children"][number];

const ROOT_ICON_DEFAULTS = { className: "shrink-0 size-[0.82rem]" };
const CHILD_ICON_DEFAULTS = { className: "shrink-0 size-[1.12rem]" };
const DEFAULT_ORDER = 999;

function normalizeName(value: string) {
    return value.toLowerCase().replace(/[-_]/g, " ").replace(/\s+/g, " ").trim();
}

function getFolderName(value: TreeEntry["name"]) {
    return typeof value === "string" ? normalizeName(value) : "";
}

function findManifestEntry(entries: DocsManifest | undefined, name: string) {
    if (!entries) return undefined;

    const normalizedName = normalizeName(name);

    return Object.entries(entries).find(([key, node]) => {
        if (normalizeName(key) === normalizedName) return true;
        return node.aliases?.some((alias) => normalizeName(alias) === normalizedName);
    });
}

function resolveManifestEntries(path: string[]) {
    return path.reduce<DocsManifest | undefined>((entries, segment) => {
        if (!entries) return undefined;
        return findManifestEntry(entries, segment)?.[1].children;
    }, docsManifest);
}

function resolveManifestNode(path: string[], name: string) {
    return findManifestEntry(resolveManifestEntries(path), name)?.[1];
}

function getEntryOrder(path: string[], name: string) {
    return resolveManifestNode(path, name)?.order ?? DEFAULT_ORDER;
}

function getEntryIcon(path: string[], name: string) {
    return renderIcon(
        resolveManifestNode(path, name)?.icon,
        path.length > 0 ? CHILD_ICON_DEFAULTS : ROOT_ICON_DEFAULTS,
    );
}

function sortFolderChildren(path: string[]) {
    return (a: FolderChildEntry, b: FolderChildEntry) => {
        if (a.type === "folder" && b.type === "folder") {
            return getEntryOrder(path, String(a.name)) - getEntryOrder(path, String(b.name));
        }

        if (a.type === "folder") return -1;
        if (b.type === "folder") return 1;
        if (a.type === "separator" || b.type === "separator") return 0;

        return getEntryOrder(path, String(a.name)) - getEntryOrder(path, String(b.name));
    };
}

function sortRootChildren(a: RootEntry, b: RootEntry) {
    if (a.type !== "folder" || b.type !== "folder") return 0;
    return getEntryOrder([], String(a.name)) - getEntryOrder([], String(b.name));
}

function decorateEntry(entry: TreeEntry, path: string[]): TreeEntry {
    if (entry.type === "separator") return entry;

    if (entry.type === "page") {
        return { ...entry, icon: getEntryIcon(path, String(entry.name)) ?? entry.icon };
    }

    const folderName = getFolderName(entry.name);
    const nextPath = [...path, folderName];

    return {
        ...entry,
        icon: getEntryIcon(path, folderName) ?? entry.icon,
        children: [...entry.children]
            .sort(sortFolderChildren(nextPath))
            .map((child) => decorateEntry(child, nextPath)),
    };
}

function renderIcon(
    iconDef?: DocsManifest[string]["icon"],
    defaults?: { className: string; style?: CSSProperties },
) {
    if (!iconDef) return undefined;

    const className =
        [defaults?.className, iconDef.className].filter(Boolean).join(" ") || "size-5";
    const style = iconDef.style ?? defaults?.style;

    switch (iconDef.source) {
        case "react":
            return createElement(iconDef.icon, {
                key: "icon",
                className,
                style,
                strokeWidth: iconDef.strokeWidth,
                "aria-hidden": true,
            });
        case "phosphor":
            return createElement(iconDef.icon, {
                key: "icon",
                className,
                style,
                weight: "fill",
                "aria-hidden": true,
            });
        case "simple":
            return createElement(
                "svg",
                {
                    key: "icon",
                    xmlns: "http://www.w3.org/2000/svg",
                    viewBox: iconDef.viewBox ?? "0 0 24 24",
                    fill: "currentColor",
                    className,
                    style,
                    "aria-hidden": true,
                },
                createElement("path", { d: iconDef.icon.path }),
            );
        case "path":
            return createElement(
                "svg",
                {
                    key: "icon",
                    xmlns: "http://www.w3.org/2000/svg",
                    viewBox: iconDef.viewBox ?? "0 0 24 24",
                    fill: "currentColor",
                    className,
                    style,
                    "aria-hidden": true,
                },
                createElement("path", { d: iconDef.path }),
            );
        case "inline-svg":
            if (iconDef.svg.trim().startsWith("<svg")) {
                const match = iconDef.svg.trim().match(/^<svg\b([^>]*)>([\s\S]*?)<\/svg>$/i);
                const inheritedViewBox = match?.[1].match(/\bviewBox=(['"])(.*?)\1/i)?.[2];

                return createElement("svg", {
                    key: "icon",
                    xmlns: "http://www.w3.org/2000/svg",
                    viewBox: iconDef.viewBox ?? inheritedViewBox ?? "0 0 24 24",
                    className,
                    style,
                    "aria-hidden": true,
                    dangerouslySetInnerHTML: { __html: match?.[2] ?? iconDef.svg },
                });
            }

            return createElement("svg", {
                key: "icon",
                xmlns: "http://www.w3.org/2000/svg",
                viewBox: iconDef.viewBox ?? "0 0 24 24",
                className,
                style,
                "aria-hidden": true,
                dangerouslySetInnerHTML: { __html: iconDef.svg },
            });
    }
}

function withIcons(tree: Root): Root {
    return {
        ...tree,
        children: [...tree.children]
            .sort(sortRootChildren)
            .map((child) => decorateEntry(child, []) as RootEntry),
    };
}

const source = loader({
    baseUrl: "/docs",
    source: docs.toFumadocsSource(),
});

source.pageTree = withIcons(source.pageTree);

export { source };
