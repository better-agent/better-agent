/** Parsed IP value. */
type ParsedIp = {
    /** IP family. */
    kind: "ipv4" | "ipv6";
    /** Numeric IP value. */
    value: bigint;
    /** Bit width for the IP family. */
    bits: number;
    /** Normalized string form. */
    normalized: string;
};

/** Parses an IPv4 string. */
function parseIpv4(input: string): ParsedIp | null {
    const parts = input.split(".");
    if (parts.length !== 4) return null;

    let value = 0n;
    for (const part of parts) {
        if (!/^\d+$/.test(part)) return null;
        const octet = Number(part);
        if (octet < 0 || octet > 255) return null;
        value = (value << 8n) | BigInt(octet);
    }

    return {
        kind: "ipv4",
        value,
        bits: 32,
        normalized: parts.join("."),
    };
}

/** Expands an IPv6 string into eight normalized segments. */
function expandIpv6Segments(input: string): string[] | null {
    const zoneIndex = input.indexOf("%");
    const value = zoneIndex >= 0 ? input.slice(0, zoneIndex) : input;
    if (value.length === 0) return null;

    const doubleColonCount = value.split("::").length - 1;
    if (doubleColonCount > 1) return null;

    const [leftRaw = "", rightRaw = ""] = value.split("::");
    const left = leftRaw.length > 0 ? leftRaw.split(":") : [];
    const right = rightRaw.length > 0 ? rightRaw.split(":") : [];

    const normalizedRight = [...right];
    if (normalizedRight.length > 0) {
        const last = normalizedRight[normalizedRight.length - 1];
        if (last?.includes(".")) {
            const ipv4 = parseIpv4(last);
            if (!ipv4) return null;
            normalizedRight.splice(
                normalizedRight.length - 1,
                1,
                Number((ipv4.value >> 16n) & 0xffffn).toString(16),
                Number(ipv4.value & 0xffffn).toString(16),
            );
        }
    }

    const normalizedLeft = [...left];
    if (normalizedLeft.length > 0) {
        const last = normalizedLeft[normalizedLeft.length - 1];
        if (last?.includes(".")) {
            const ipv4 = parseIpv4(last);
            if (!ipv4) return null;
            normalizedLeft.splice(
                normalizedLeft.length - 1,
                1,
                Number((ipv4.value >> 16n) & 0xffffn).toString(16),
                Number(ipv4.value & 0xffffn).toString(16),
            );
        }
    }

    const totalSegments = normalizedLeft.length + normalizedRight.length;
    if (doubleColonCount === 0 && totalSegments !== 8) return null;
    if (doubleColonCount === 1 && totalSegments >= 8) return null;

    const missing = doubleColonCount === 1 ? 8 - totalSegments : 0;
    const segments = [
        ...normalizedLeft,
        ...Array.from({ length: missing }, () => "0"),
        ...normalizedRight,
    ];

    if (segments.length !== 8) return null;
    if (segments.some((segment) => !/^[0-9a-fA-F]{1,4}$/.test(segment))) return null;

    return segments.map((segment) => segment.toLowerCase());
}

/** Parses an IPv6 string. */
function parseIpv6(input: string): ParsedIp | null {
    const segments = expandIpv6Segments(input);
    if (!segments) return null;

    let value = 0n;
    for (const segment of segments) {
        value = (value << 16n) | BigInt(Number.parseInt(segment, 16));
    }

    return {
        kind: "ipv6",
        value,
        bits: 128,
        normalized: segments.join(":"),
    };
}

/** Parses an IPv4 or IPv6 string. */
export function parseIp(input: string): ParsedIp | null {
    const value = input.trim();
    if (value.length === 0) return null;
    return parseIpv4(value) ?? parseIpv6(value);
}

/** Normalizes an IP string. */
export function normalizeIp(input: string): string | null {
    return parseIp(input)?.normalized ?? null;
}

export type { ParsedIp };
