import { cookbookSource } from "@/lib/cookbook-source";
import { getLLMText } from "@/lib/get-llm-text";
import { notFound } from "next/navigation";

export const revalidate = false;

interface RouteProps {
    params: Promise<{ slug: string }>;
}

export async function GET(_req: Request, { params }: RouteProps) {
    const { slug } = await params;
    const page = cookbookSource.getPage([slug]);

    if (!page) notFound();

    return new Response(await getLLMText(page), {
        headers: {
            "Content-Type": "text/markdown; charset=utf-8",
        },
    });
}

export function generateStaticParams() {
    return cookbookSource.generateParams().map((params) => ({
        slug: params.slug?.[0] ?? "",
    }));
}
