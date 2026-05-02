import { describe, expect, test } from "bun:test";
import { createDisconnectSignal, isDisconnectError } from "../src/shared/disconnect";
import { MockRequest, MockResponse } from "./helpers";

describe("disconnect", () => {
    test("aborts when request is already aborted", () => {
        const request = new MockRequest();
        request.aborted = true;

        expect(createDisconnectSignal(request).aborted).toBe(true);
    });

    test("aborts on request aborted event", () => {
        const request = new MockRequest();
        const signal = createDisconnectSignal(request);

        request.emit("aborted");

        expect(signal.aborted).toBe(true);
    });

    test("aborts when response closes before finishing", () => {
        const request = new MockRequest();
        const response = new MockResponse();
        const signal = createDisconnectSignal(request, response);

        response.emit("close");

        expect(signal.aborted).toBe(true);
    });

    test("does not abort when response closes after finishing", () => {
        const request = new MockRequest();
        const response = new MockResponse();
        response.writableEnded = true;
        const signal = createDisconnectSignal(request, response);

        response.emit("close");

        expect(signal.aborted).toBe(false);
    });

    test("detects disconnect errors", () => {
        const abortError = new Error("The operation was aborted");
        abortError.name = "AbortError";

        expect(isDisconnectError(abortError)).toBe(true);
        expect(isDisconnectError(new Error("socket aborted"))).toBe(true);
        expect(isDisconnectError(new Error("boom"))).toBe(false);
        expect(isDisconnectError("aborted")).toBe(false);
    });
});
