import { isMarkdownPreferred, rewritePath } from "fumadocs-core/negotiation";
import { type NextRequest, NextResponse } from "next/server";

const { rewrite: rewriteDocsLLM } = rewritePath("/docs{/*path}", "/llms.mdx/docs{/*path}");
const { rewrite: rewriteCookbookLLM } = rewritePath(
    "/cookbook{/*path}",
    "/llms.mdx/cookbook{/*path}",
);

export default function proxy(request: NextRequest) {
    if (!isMarkdownPreferred(request)) {
        return NextResponse.next();
    }

    const docsResult = rewriteDocsLLM(request.nextUrl.pathname);

    if (docsResult) {
        return NextResponse.rewrite(new URL(docsResult, request.nextUrl));
    }

    const cookbookResult = rewriteCookbookLLM(request.nextUrl.pathname);

    if (cookbookResult) {
        return NextResponse.rewrite(new URL(cookbookResult, request.nextUrl));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/docs/:path*", "/cookbook/:path*"],
};
