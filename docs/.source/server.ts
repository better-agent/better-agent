// @ts-nocheck
import * as __fd_glob_40 from "../contents/docs/integrations/full-stack/tanstack-start.mdx?collection=docs"
import * as __fd_glob_39 from "../contents/docs/integrations/full-stack/sveltekit.mdx?collection=docs"
import * as __fd_glob_38 from "../contents/docs/integrations/full-stack/solidstart.mdx?collection=docs"
import * as __fd_glob_37 from "../contents/docs/integrations/full-stack/remix.mdx?collection=docs"
import * as __fd_glob_36 from "../contents/docs/integrations/full-stack/nuxt.mdx?collection=docs"
import * as __fd_glob_35 from "../contents/docs/integrations/full-stack/nextjs.mdx?collection=docs"
import * as __fd_glob_34 from "../contents/docs/integrations/full-stack/astro.mdx?collection=docs"
import * as __fd_glob_33 from "../contents/docs/integrations/backend/hono.mdx?collection=docs"
import * as __fd_glob_32 from "../contents/docs/integrations/backend/fastify.mdx?collection=docs"
import * as __fd_glob_31 from "../contents/docs/integrations/backend/express.mdx?collection=docs"
import * as __fd_glob_30 from "../contents/docs/integrations/backend/elysia.mdx?collection=docs"
import * as __fd_glob_29 from "../contents/docs/plugins/sandbox.mdx?collection=docs"
import * as __fd_glob_28 from "../contents/docs/plugins/rate-limit.mdx?collection=docs"
import * as __fd_glob_27 from "../contents/docs/plugins/logging.mdx?collection=docs"
import * as __fd_glob_26 from "../contents/docs/plugins/ip-allowlist.mdx?collection=docs"
import * as __fd_glob_25 from "../contents/docs/plugins/auth.mdx?collection=docs"
import * as __fd_glob_24 from "../contents/docs/providers/xai.mdx?collection=docs"
import * as __fd_glob_23 from "../contents/docs/providers/openai.mdx?collection=docs"
import * as __fd_glob_22 from "../contents/docs/providers/anthropic.mdx?collection=docs"
import * as __fd_glob_21 from "../contents/docs/get-started/usage.mdx?collection=docs"
import * as __fd_glob_20 from "../contents/docs/get-started/llms-txt.mdx?collection=docs"
import * as __fd_glob_19 from "../contents/docs/get-started/introduction.mdx?collection=docs"
import * as __fd_glob_18 from "../contents/docs/get-started/installation.mdx?collection=docs"
import * as __fd_glob_17 from "../contents/docs/concepts/typescript.mdx?collection=docs"
import * as __fd_glob_16 from "../contents/docs/concepts/tools.mdx?collection=docs"
import * as __fd_glob_15 from "../contents/docs/concepts/structured-output.mdx?collection=docs"
import * as __fd_glob_14 from "../contents/docs/concepts/providers.mdx?collection=docs"
import * as __fd_glob_13 from "../contents/docs/concepts/plugins.mdx?collection=docs"
import * as __fd_glob_12 from "../contents/docs/concepts/persistence.mdx?collection=docs"
import * as __fd_glob_11 from "../contents/docs/concepts/mcp.mdx?collection=docs"
import * as __fd_glob_10 from "../contents/docs/concepts/hil.mdx?collection=docs"
import * as __fd_glob_9 from "../contents/docs/concepts/events.mdx?collection=docs"
import * as __fd_glob_8 from "../contents/docs/concepts/errors.mdx?collection=docs"
import * as __fd_glob_7 from "../contents/docs/concepts/client.mdx?collection=docs"
import * as __fd_glob_6 from "../contents/docs/concepts/cli.mdx?collection=docs"
import * as __fd_glob_5 from "../contents/docs/concepts/api.mdx?collection=docs"
import * as __fd_glob_4 from "../contents/docs/concepts/agent.mdx?collection=docs"
import * as __fd_glob_3 from "../contents/cookbook/build-an-mcp-chat.mdx?collection=cookbook"
import * as __fd_glob_2 from "../contents/cookbook/build-a-structured-extraction-pipeline.mdx?collection=cookbook"
import * as __fd_glob_1 from "../contents/cookbook/build-a-rag-agent.mdx?collection=cookbook"
import * as __fd_glob_0 from "../contents/cookbook/build-a-human-in-the-loop-chat.mdx?collection=cookbook"
import { server } from 'fumadocs-mdx/runtime/server';
import type * as Config from '../source.config';

const create = server<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
}>({"doc":{"passthroughs":["extractedReferences"]}});

export const cookbook = await create.docs("cookbook", "contents/cookbook", {}, {"build-a-human-in-the-loop-chat.mdx": __fd_glob_0, "build-a-rag-agent.mdx": __fd_glob_1, "build-a-structured-extraction-pipeline.mdx": __fd_glob_2, "build-an-mcp-chat.mdx": __fd_glob_3, });

export const docs = await create.docs("docs", "contents/docs", {}, {"concepts/agent.mdx": __fd_glob_4, "concepts/api.mdx": __fd_glob_5, "concepts/cli.mdx": __fd_glob_6, "concepts/client.mdx": __fd_glob_7, "concepts/errors.mdx": __fd_glob_8, "concepts/events.mdx": __fd_glob_9, "concepts/hil.mdx": __fd_glob_10, "concepts/mcp.mdx": __fd_glob_11, "concepts/persistence.mdx": __fd_glob_12, "concepts/plugins.mdx": __fd_glob_13, "concepts/providers.mdx": __fd_glob_14, "concepts/structured-output.mdx": __fd_glob_15, "concepts/tools.mdx": __fd_glob_16, "concepts/typescript.mdx": __fd_glob_17, "get-started/installation.mdx": __fd_glob_18, "get-started/introduction.mdx": __fd_glob_19, "get-started/llms-txt.mdx": __fd_glob_20, "get-started/usage.mdx": __fd_glob_21, "providers/anthropic.mdx": __fd_glob_22, "providers/openai.mdx": __fd_glob_23, "providers/xai.mdx": __fd_glob_24, "plugins/auth.mdx": __fd_glob_25, "plugins/ip-allowlist.mdx": __fd_glob_26, "plugins/logging.mdx": __fd_glob_27, "plugins/rate-limit.mdx": __fd_glob_28, "plugins/sandbox.mdx": __fd_glob_29, "integrations/backend/elysia.mdx": __fd_glob_30, "integrations/backend/express.mdx": __fd_glob_31, "integrations/backend/fastify.mdx": __fd_glob_32, "integrations/backend/hono.mdx": __fd_glob_33, "integrations/full-stack/astro.mdx": __fd_glob_34, "integrations/full-stack/nextjs.mdx": __fd_glob_35, "integrations/full-stack/nuxt.mdx": __fd_glob_36, "integrations/full-stack/remix.mdx": __fd_glob_37, "integrations/full-stack/solidstart.mdx": __fd_glob_38, "integrations/full-stack/sveltekit.mdx": __fd_glob_39, "integrations/full-stack/tanstack-start.mdx": __fd_glob_40, });