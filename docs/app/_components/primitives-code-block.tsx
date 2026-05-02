import { codeToHtml } from "shiki";

type PrimitivesCodeBlockProps = {
    code: string;
    filename: string;
};

export default async function PrimitivesCodeBlock({ code, filename }: PrimitivesCodeBlockProps) {
    const html = await codeToHtml(code, {
        lang: "ts",
        themes: {
            light: "github-light",
            dark: "github-dark",
        },
        defaultColor: false,
        cssVariablePrefix: "--shiki-",
    });

    return (
        <div
            className="code-demo-pane my-0 flex h-[22rem] max-h-[22rem] flex-col overflow-hidden border border-[color:var(--border)] sm:h-[24rem] sm:max-h-[24rem]"
            style={{ background: "var(--code-block-bg)" }}
        >
            <div
                className="flex h-8 shrink-0 items-center border-b px-4"
                style={{ borderColor: "var(--showcase-shell-border)" }}
            >
                <span
                    className="text-[11px] tracking-[0.02em]"
                    style={{ color: "var(--showcase-tab-idle)" }}
                >
                    {filename}
                </span>
            </div>
            <div
                className="primitives-shiki min-h-0 flex-1 overflow-auto pt-3 pr-4 pb-4 sm:pt-4 sm:pr-5 sm:pb-5"
                dangerouslySetInnerHTML={{ __html: html }}
            />
        </div>
    );
}
