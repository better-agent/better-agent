/**
 * Creates an ID generator.
 *
 * IDs look like `<prefix>_<ts>_<counter>_<random>`, for example:
 * `agent_m8x2k1f9_0001_a1b2c3d4`.
 */
export const createIdGenerator = (config: {
    prefixes?: Record<string, string>;
    counterMax?: number;
}): ((kind: string) => string) => {
    let counter = 0;
    const counterMax = config.counterMax ?? 1_000_000;
    const prefixes = config.prefixes ?? {};

    return (kind: string) => {
        const prefix = prefixes[kind] ?? kind;
        counter = (counter + 1) % counterMax;

        const ts = Date.now().toString(36);
        const cnt = counter.toString(36).padStart(4, "0");
        const rand = Math.random().toString(36).slice(2, 10);

        return `${prefix}_${ts}_${cnt}_${rand}`;
    };
};
