import { defineConfig } from "@solidjs/start/config";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
    server: {
        preset: "node-server",
    },
    vite: {
        plugins: [tailwindcss()],
        server: {
            port: 3000,
        },
    },
});
