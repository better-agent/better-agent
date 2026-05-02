import docsConfig from "@/docs.config";
import { type GetMDXComponentsOptions, getMDXComponents } from "@farming-labs/theme/mdx";
import type { MDXComponents } from "mdx/types";

export function useMDXComponents(components?: MDXComponents): MDXComponents {
    const promptIconRegistry = docsConfig.icons as GetMDXComponentsOptions["icons"];
    const promptOpenDocsProviders =
        docsConfig.pageActions?.openDocs && typeof docsConfig.pageActions.openDocs === "object"
            ? (docsConfig.pageActions.openDocs
                  .providers as GetMDXComponentsOptions["openDocsProviders"])
            : undefined;

    return getMDXComponents(
        {
            ...(docsConfig.components as MDXComponents),
            ...components,
        },
        {
            onCopyClick: docsConfig.onCopyClick,
            theme: docsConfig.theme,
            icons: promptIconRegistry,
            openDocsProviders: promptOpenDocsProviders,
        },
    );
}
