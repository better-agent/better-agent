/**
 * Model Context Protocol (MCP) type definitions.
 *
 * Based on the MCP specification dated `2025-11-25`.
 */

/** Latest MCP protocol version. */
export const LATEST_PROTOCOL_VERSION = "2025-11-25";

/** Supported protocol versions. */
export const SUPPORTED_PROTOCOL_VERSIONS = [
    LATEST_PROTOCOL_VERSION,
    "2025-06-18",
    "2025-03-26",
    "2024-11-05",
] as const;

/** MCP server capabilities. */
export interface ServerCapabilities {
    /** Server supports logging notifications. */
    logging?: Record<string, never>;

    /** Server supports prompts. */
    prompts?: {
        /** Server supports `listChanged` notifications. */
        listChanged?: boolean;
    };

    /** Server supports resources. */
    resources?: {
        /** Server supports resource subscription. */
        subscribe?: boolean;
        /** Server supports `listChanged` notifications. */
        listChanged?: boolean;
    };

    /** Server supports tools. */
    tools?: {
        /** Server supports `listChanged` notifications. */
        listChanged?: boolean;
    };

    /** Experimental capabilities. */
    experimental?: Record<string, unknown>;
}

/** MCP client capabilities. */
export interface ClientCapabilities {
    /** Client supports receiving roots. */
    roots?: {
        /** Client supports `listChanged` notifications. */
        listChanged?: boolean;
    };

    /** Client supports sampling. */
    sampling?: Record<string, never>;

    /** Client supports elicitation. */
    elicitation?: {
        /** Whether to apply default values from schema. */
        applyDefaults?: boolean;
    };

    /** Experimental capabilities. */
    experimental?: Record<string, unknown>;
}

/** Client or server implementation info. */
export interface MCPImplementationInfo {
    name: string;
    version: string;
}

/** Initialize request params. */
export interface InitializeParams {
    protocolVersion: string;
    capabilities: ClientCapabilities;
    clientInfo: MCPImplementationInfo;
}

/** Initialize result. */
export interface InitializeResult {
    protocolVersion: string;
    capabilities: ServerCapabilities;
    serverInfo: MCPImplementationInfo;
    /** Instructions for the client. */
    instructions?: string;
}

/** Paginated request params. */
export interface PaginatedRequest {
    cursor?: string;
}

/** Paginated result base. */
export interface PaginatedResult {
    nextCursor?: string;
}

/** MCP tool definition. */
export interface MCPTool {
    /** Tool name. */
    name: string;

    /** Tool description. */
    description?: string;

    /** JSON Schema for tool input. */
    inputSchema: {
        type: "object";
        properties?: Record<string, unknown>;
        required?: string[];
        $schema?: string;
    };

    /** Tool annotations. */
    annotations?: {
        /** Human-readable title. */
        title?: string;
        /** Whether the tool may perform destructive updates. */
        destructive?: boolean;
        /** Whether the tool may return different results for the same input. */
        idempotent?: boolean;
        /** Whether the tool may open UI. */
        openWorld?: boolean;
        /** Whether the tool may read data. */
        readOnly?: boolean;
    };

    /** Arbitrary metadata. */
    _meta?: Record<string, unknown>;
}

/** List tools result. */
export interface ListToolsResult extends PaginatedResult {
    tools: MCPTool[];
}

/** Tool call request params. */
export interface MCPCallToolParams {
    /** Tool name. */
    name: string;

    /** Tool arguments. */
    arguments?: Record<string, unknown>;

    /** Additional metadata. */
    _meta?: Record<string, unknown>;
}

/** Tool result content item. */
export type ToolResultContent =
    | { type: "text"; text: string }
    | { type: "image"; data: string; mimeType: string }
    | { type: "resource"; resource: MCPResource };

/** Tool call result. */
export interface MCPCallToolResult {
    /** Tool result content. */
    content: ToolResultContent[];

    /** Whether the result is an error. */
    isError?: boolean;

    /** Structured content, when available. */
    structuredContent?: unknown;
}

/** MCP resource. */
export interface MCPResource {
    /** Resource URI. */
    uri: string;

    /** Resource name. */
    name: string;

    /** Resource description. */
    description?: string;

    /** MIME type. */
    mimeType?: string;

    /** Resource size in bytes, if known. */
    size?: number;

    /** Resource content. */
    text?: string;

    /** Binary content in base64 form. */
    blob?: string;
}

/** List resources result. */
export interface ListResourcesResult extends PaginatedResult {
    resources: MCPResource[];
}

/** Resource template. */
export interface MCPResourceTemplate {
    /** URI template. */
    uriTemplate: string;

    /** Template name. */
    name: string;

    /** Template description. */
    description?: string;

    /** MIME type. */
    mimeType?: string;
}

/** List resource templates result. */
export interface ListResourceTemplatesResult extends PaginatedResult {
    resourceTemplates: MCPResourceTemplate[];
}

/** Read resource request. */
export interface MCPReadResourceParams {
    /** Resource URI. */
    uri: string;
}

/** Read resource result. */
export interface MCPReadResourceResult {
    contents: MCPResource[];
}

/** MCP prompt. */
export interface MCPPrompt {
    /** Prompt name. */
    name: string;

    /** Prompt description. */
    description?: string;

    /** Prompt arguments schema. */
    arguments?: Array<{
        /** Argument name. */
        name: string;
        /** Argument description. */
        description?: string;
        /** Whether the argument is required. */
        required?: boolean;
    }>;
}

/** List prompts result. */
export interface ListPromptsResult extends PaginatedResult {
    prompts: MCPPrompt[];
}

/** Get prompt request. */
export interface MCPGetPromptParams {
    /** Prompt name. */
    name: string;

    /** Prompt arguments. */
    arguments?: Record<string, string>;
}

/** Prompt message */
export type PromptMessage =
    | { role: "user"; content: { type: "text"; text: string } }
    | { role: "assistant"; content: { type: "text"; text: string } };

/** Get prompt result */
export interface MCPGetPromptResult {
    /** Prompt description */
    description?: string;

    /** Prompt messages */
    messages: PromptMessage[];
}

/** Request options for MCP operations */
export interface RequestOptions {
    /** Abort signal for cancellation */
    signal?: AbortSignal;

    /** Timeout in milliseconds */
    timeout?: number;
}
