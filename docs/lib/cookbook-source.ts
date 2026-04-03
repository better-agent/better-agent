import { cookbook } from "collections/server";
import { loader } from "fumadocs-core/source";

export const cookbookSource = loader({
    baseUrl: "/cookbook",
    source: cookbook.toFumadocsSource(),
});
