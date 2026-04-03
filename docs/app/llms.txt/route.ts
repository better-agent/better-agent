import { getLLMSourcesIndex } from "@/lib/llms";

export const revalidate = false;

export function GET() {
    return new Response(getLLMSourcesIndex(), {
        headers: {
            "Content-Type": "text/plain; charset=utf-8",
        },
    });
}
