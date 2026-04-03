import { getLLMSourcesFullText } from "@/lib/llms";

export const revalidate = false;

export async function GET() {
    return new Response(await getLLMSourcesFullText(), {
        headers: {
            "Content-Type": "text/plain; charset=utf-8",
        },
    });
}
