import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import appCss from "./app.css?url";

export default function App() {
    return (
        <html lang="en">
            <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <Meta />
                <Links />
                <link rel="stylesheet" href={appCss} />
            </head>
            <body>
                <Outlet />
                <ScrollRestoration />
                <Scripts />
            </body>
        </html>
    );
}
