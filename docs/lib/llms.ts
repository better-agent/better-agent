import { llms } from "fumadocs-core/source";

import { cookbookSource } from "@/lib/cookbook-source";
import { getLLMText } from "@/lib/get-llm-text";
import { source } from "@/lib/source";

export function getLLMSourcesIndex() {
    return [
        "# Better Agent LLM Index",
        "",
        "## Documentation",
        "",
        llms(source).index(),
        "",
        "## Cookbook",
        "",
        llms(cookbookSource).index(),
    ].join("\n");
}

export async function getLLMSourcesFullText() {
    const pages = [...source.getPages(), ...cookbookSource.getPages()].sort((a, b) =>
        a.url.localeCompare(b.url),
    );

    const scanned = await Promise.all(pages.map(getLLMText));

    return scanned.join("\n\n");
}
