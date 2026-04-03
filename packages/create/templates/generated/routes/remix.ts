import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import app from "../better-agent/server";

export async function loader({ request }: LoaderFunctionArgs): Promise<Response> {
    return app.handler(request);
}

export async function action({ request }: ActionFunctionArgs): Promise<Response> {
    return app.handler(request);
}
