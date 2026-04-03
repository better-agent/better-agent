import { defineConfig, defineDocs } from "fumadocs-mdx/config";

export const docs = defineDocs({
    dir: "contents/docs",
    docs: {
        postprocess: {
            includeProcessedMarkdown: true,
        },
    },
});

export const cookbook = defineDocs({
    dir: "contents/cookbook",
    docs: {
        postprocess: {
            includeProcessedMarkdown: true,
        },
    },
});

export default defineConfig({
    mdxOptions: {
        rehypeCodeOptions: {
            themes: {
                light: "one-light",
                dark: "one-dark-pro",
            },
        },
    },
});
