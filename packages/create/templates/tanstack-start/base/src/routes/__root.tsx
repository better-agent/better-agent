import { HeadContent, Outlet, Scripts, createRootRoute } from "@tanstack/react-router";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
    head: () => ({
        meta: [
            { charSet: "utf-8" },
            { name: "viewport", content: "width=device-width, initial-scale=1" },
            { title: "Better Agent Starter" },
        ],
        links: [{ rel: "stylesheet", href: appCss }],
    }),
    component: RootDocument,
});

function RootDocument() {
    return (
        <html lang="en">
            <head>
                <HeadContent />
            </head>
            <body>
                <Outlet />
                <Scripts />
            </body>
        </html>
    );
}
