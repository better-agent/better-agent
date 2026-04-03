export type TypegenAppExport = {
    config: Record<string, unknown>;
};

export type GenerateTypeOptions = {
    config?: string[];
    cwd?: string;
    out?: string;
    name?: string;
    yes?: boolean;
};

export type DiscoveredApp = {
    app: TypegenAppExport;
    configFile: string;
    exportPath: string[];
    label: string;
};

export type TypegenAppReference = {
    configFile: string;
    exportPath: string[];
    label: string;
};
