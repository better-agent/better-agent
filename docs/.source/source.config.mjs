// source.config.ts
import { defineConfig, defineDocs } from "fumadocs-mdx/config";
var docs = defineDocs({
  dir: "contents/docs",
  docs: {
    postprocess: {
      includeProcessedMarkdown: true
    }
  }
});
var cookbook = defineDocs({
  dir: "contents/cookbook",
  docs: {
    postprocess: {
      includeProcessedMarkdown: true
    }
  }
});
var source_config_default = defineConfig({
  mdxOptions: {
    rehypeCodeOptions: {
      themes: {
        light: "one-light",
        dark: "one-dark-pro"
      }
    }
  }
});
export {
  cookbook,
  source_config_default as default,
  docs
};
