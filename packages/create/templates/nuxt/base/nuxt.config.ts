export default defineNuxtConfig({
    compatibilityDate: "2025-07-15",
    devtools: { enabled: true },
    app: {
        head: {
            title: "Better Agent Starter",
        },
    },
    css: ["~~/assets/css/main.css"],
    postcss: {
        plugins: {
            "@tailwindcss/postcss": {},
        },
    },
});
