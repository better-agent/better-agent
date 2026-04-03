import { cookbookSource } from "@/lib/cookbook-source";
import { source } from "@/lib/source";
import { createFromSource } from "fumadocs-core/search/server";

export const revalidate = false;

const docsSearch = createFromSource(source);
const cookbookSearch = createFromSource(cookbookSource);

export async function GET(request: Request) {
    const url = new URL(request.url);
    const query = url.searchParams.get("query") ?? "";
    const [docsResults, cookbookResults] = await Promise.all([
        docsSearch.search(query),
        cookbookSearch.search(query),
    ]);

    return Response.json([...docsResults, ...cookbookResults]);
}
