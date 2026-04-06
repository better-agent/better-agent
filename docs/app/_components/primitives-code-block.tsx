import { ServerCodeBlock } from "fumadocs-ui/components/codeblock.rsc";

type PrimitivesCodeBlockProps = {
    code: string;
    filename: string;
    language?: "ts" | "tsx" | "js" | "jsx" | "json" | "bash" | "sh" | "text";
};

export default async function PrimitivesCodeBlock({
    code,
    filename: _filename,
    language = "ts",
}: PrimitivesCodeBlockProps) {
    return (
        <ServerCodeBlock
            code={code}
            lang={language}
            themes={{
                light: "one-light",
                dark: "one-dark-pro",
            }}
            codeblock={{
                allowCopy: true,
                className:
                    "my-0 rounded-none border border-t-0 border-[color:var(--border)] bg-white text-[11.5px] dark:bg-[var(--panel)] sm:text-[12px]",
                viewportProps: {
                    className:
                        "bg-white pt-4 opacity-88 dark:bg-[var(--panel)] sm:[&_pre]:text-[12px] [&_pre]:text-[11.5px] [&_.shiki]:opacity-88",
                },
            }}
        />
    );
}
