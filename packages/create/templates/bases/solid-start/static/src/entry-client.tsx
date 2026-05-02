import { StartClient, mount } from "@solidjs/start/client";

const root = document.getElementById("app");

if (!root) {
    throw new Error('Missing "#app" root element.');
}

mount(() => <StartClient />, root);
