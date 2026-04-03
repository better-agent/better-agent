import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
    plugins: [
        devtools(),
        tsconfigPaths({ projects: ["./tsconfig.json"] }),
        tailwindcss(),
        tanstackStart(),
        viteReact(),
    ],
});
