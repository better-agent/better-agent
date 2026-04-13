import { NextResponse } from "next/server";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

type DemoRequestBody = {
    prompt?: string;
    audioBase64?: string;
    audioFormat?: string;
};

type OpenRouterChunk = {
    choices?: Array<{
        delta?: {
            content?: string;
            audio?: {
                data?: string;
                transcript?: string;
            };
        };
    }>;
};

export async function POST(request: Request) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
        return NextResponse.json(
            {
                code: "MISSING_OPENROUTER_API_KEY",
                message: "Set OPENROUTER_API_KEY in your environment before using this demo.",
            },
            { status: 500 },
        );
    }

    let body: DemoRequestBody;
    try {
        body = (await request.json()) as DemoRequestBody;
    } catch {
        return NextResponse.json(
            {
                code: "INVALID_JSON",
                message: "Request body must be valid JSON.",
            },
            { status: 400 },
        );
    }

    const prompt = body.prompt?.trim();
    const audioBase64 = body.audioBase64?.trim();
    const audioFormat = body.audioFormat?.trim() || "wav";

    if (!prompt) {
        return NextResponse.json(
            {
                code: "MISSING_PROMPT",
                message: "Prompt is required.",
            },
            { status: 400 },
        );
    }

    const userContent = [
        {
            type: "text",
            text: prompt,
        },
        ...(audioBase64
            ? [
                  {
                      type: "input_audio",
                      input_audio: {
                          data: audioBase64,
                          format: audioFormat,
                      },
                  },
              ]
            : []),
    ];

    const payload = {
        model: "openai/gpt-audio-mini",
        messages: [
            {
                role: "user",
                content: userContent,
            },
        ],
        modalities: ["text", "audio"],
        audio: {
            voice: "alloy",
            format: "wav",
        },
        stream: true,
    };

    const response = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
        cache: "no-store",
    });

    if (!response.ok) {
        const text = await response.text();
        let parsed: unknown = text;

        try {
            parsed = JSON.parse(text);
        } catch {
            // Return raw text when upstream does not send JSON.
        }

        return NextResponse.json(parsed, { status: response.status });
    }

    if (!response.body) {
        return NextResponse.json(
            {
                code: "MISSING_RESPONSE_BODY",
                message: "Upstream response body was empty.",
            },
            { status: 502 },
        );
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let textOutput = "";
    let transcript = "";
    let audioBase64Output = "";

    while (true) {
        const { value, done } = await reader.read();
        if (done) {
            break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data: ")) {
                continue;
            }

            const data = trimmed.slice(6);
            if (data === "[DONE]") {
                continue;
            }

            let chunk: OpenRouterChunk;
            try {
                chunk = JSON.parse(data) as OpenRouterChunk;
            } catch {
                continue;
            }

            const delta = chunk.choices?.[0]?.delta;
            if (typeof delta?.content === "string") {
                textOutput += delta.content;
            }

            if (typeof delta?.audio?.transcript === "string") {
                transcript += delta.audio.transcript;
            }

            if (typeof delta?.audio?.data === "string") {
                audioBase64Output += delta.audio.data;
            }
        }
    }

    return NextResponse.json({
        request: payload,
        text: textOutput,
        transcript,
        audioBase64: audioBase64Output,
        audioMimeType: "audio/wav",
    });
}
