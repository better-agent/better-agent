import { describe, expect, test } from "bun:test";
import { EventEmitter } from "node:events";
import { createDisconnectSignal } from "../src/shared/disconnect";

class MockRequest extends EventEmitter {
    aborted = false;
}

class MockResponse extends EventEmitter {
    writableEnded = false;
}

describe("createDisconnectSignal", () => {
    test("does not abort on a normal request close lifecycle", () => {
        const request = new MockRequest();
        const response = new MockResponse();

        const signal = createDisconnectSignal(request, response);

        request.emit("close");

        expect(signal.aborted).toBe(false);
    });

    test("aborts when the request is aborted", () => {
        const request = new MockRequest();
        const response = new MockResponse();

        const signal = createDisconnectSignal(request, response);

        request.aborted = true;
        request.emit("aborted");

        expect(signal.aborted).toBe(true);
    });

    test("aborts when the response closes before finishing", () => {
        const request = new MockRequest();
        const response = new MockResponse();

        const signal = createDisconnectSignal(request, response);

        response.emit("close");

        expect(signal.aborted).toBe(true);
    });

    test("does not abort when the response closes after finishing", () => {
        const request = new MockRequest();
        const response = new MockResponse();
        response.writableEnded = true;

        const signal = createDisconnectSignal(request, response);

        response.emit("close");

        expect(signal.aborted).toBe(false);
    });
});
