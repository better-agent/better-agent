import { defineConfig } from "@solidjs/start/config";
import tailwindcss from "@tailwindcss/postcss";

export default defineConfig({
    server: {
        preset: "node-server",
    },
    vite: {
        server: {
            port: 3000,
        },
        css: {
            postcss: {
                plugins: [tailwindcss()],
            },
        },
    },
});
