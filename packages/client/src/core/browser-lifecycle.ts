declare global {
    interface Window {
        __baPageTeardown?: boolean;
        __baPageTeardownInstalled?: boolean;
    }
}

const markPageTeardown = () => {
    if (typeof window !== "undefined") {
        window.__baPageTeardown = true;
    }
};

export const ensureBrowserTeardownTracking = (): void => {
    if (typeof window === "undefined") {
        return;
    }

    window.__baPageTeardown ??= false;
    if (window.__baPageTeardownInstalled) {
        return;
    }

    window.__baPageTeardownInstalled = true;
    window.addEventListener("pagehide", markPageTeardown);
    window.addEventListener("beforeunload", markPageTeardown);
};

export const isBrowserPageTearingDown = (): boolean =>
    typeof window !== "undefined" && window.__baPageTeardown === true;
