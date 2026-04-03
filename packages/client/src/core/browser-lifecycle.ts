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

/** Installs one browser teardown tracker for refresh/navigation. */
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

/** Returns true while the current browser page is being torn down. */
export const isBrowserPageTearingDown = (): boolean =>
    typeof window !== "undefined" && window.__baPageTeardown === true;
