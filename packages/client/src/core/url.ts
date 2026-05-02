const ABSOLUTE_URL_PATTERN = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//;

export const isAbsoluteURL = (url: string): boolean => ABSOLUTE_URL_PATTERN.test(url);

export async function resolveRequestURL(url: string): Promise<string> {
    if (isAbsoluteURL(url)) {
        return url;
    }

    if (typeof window !== "undefined") {
        return url;
    }

    throw new Error(
        "Relative Better Agent URLs work only in browser contexts. Use an absolute URL on the server or call the app directly.",
    );
}
