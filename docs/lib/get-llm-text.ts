import type { InferPageType } from "fumadocs-core/source";
import type { DocMethods } from "fumadocs-mdx/runtime/types";

import type { cookbookSource } from "@/lib/cookbook-source";
import type { source } from "@/lib/source";

export async function getLLMText(
    page: InferPageType<typeof source> | InferPageType<typeof cookbookSource>,
) {
    const pageData = page.data as typeof page.data & Pick<DocMethods, "getText">;
    const processed = await pageData.getText("processed");
    const title = page.data.title ?? "Untitled";

    return `# ${title} (${page.url})

${processed}`;
}
