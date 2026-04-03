export function JsonLdScript({ data }: { data: unknown }) {
    return <script type="application/ld+json">{JSON.stringify(data)}</script>;
}
