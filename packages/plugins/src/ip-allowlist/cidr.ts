import { type ParsedIp, parseIp } from "./ip";

/** Matcher for one allowed IP entry. */
export type IpMatcher = {
    /** Original allowlist entry. */
    raw: string;
    /** Returns true when the IP matches this entry. */
    matches: (ip: ParsedIp) => boolean;
};

/** Creates a network mask for the given prefix. */
function createMask(bits: number, prefix: number): bigint {
    if (prefix === 0) return 0n;
    return ((1n << BigInt(prefix)) - 1n) << BigInt(bits - prefix);
}

/** Parses one allowlist IP or CIDR entry. */
export function parseAllowEntry(input: string): IpMatcher | null {
    const raw = input.trim();
    if (raw.length === 0) return null;

    const slashIndex = raw.indexOf("/");
    if (slashIndex === -1) {
        const parsed = parseIp(raw);
        if (!parsed) return null;
        return {
            raw,
            matches: (ip) => ip.kind === parsed.kind && ip.value === parsed.value,
        };
    }

    const addressPart = raw.slice(0, slashIndex).trim();
    const prefixPart = raw.slice(slashIndex + 1).trim();
    if (!/^\d+$/.test(prefixPart)) return null;

    const parsed = parseIp(addressPart);
    if (!parsed) return null;

    const prefix = Number(prefixPart);
    if (prefix < 0 || prefix > parsed.bits) return null;

    const mask = createMask(parsed.bits, prefix);
    const network = parsed.value & mask;

    return {
        raw,
        matches: (ip) => ip.kind === parsed.kind && (ip.value & mask) === network,
    };
}
