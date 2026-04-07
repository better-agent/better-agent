import { readFileSync } from "node:fs";
import path from "node:path";
import type { PluginId, ProviderId, SandboxClientId } from "./types";

type DependencySelection = {
    providers: ProviderId[];
    plugins: PluginId[];
    sandboxClient?: SandboxClientId;
};

type PackageJsonVersion = {
    version?: string;
};

const EXTERNAL_PACKAGE_VERSIONS = {
    e2b: "2.1.4",
    "@daytonaio/sdk": "0.27.0",
} as const;

export const getCliVersion = () => {
    const packageJsonPath = path.resolve(import.meta.dirname, "..", "package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as PackageJsonVersion;
    return packageJson.version ?? "0.0.0";
};

export const publishedVersionRange = (version: string) => {
    if (!/^\d+\.\d+\.\d+(?:[-+].+)?$/.test(version)) {
        return "latest";
    }

    return version.includes("-") ? version : `^${version}`;
};

export const requiredPackages = ({ plugins, sandboxClient }: DependencySelection) => {
    const packages = ["@better-agent/core", "@better-agent/client", "@better-agent/providers"];
    if (plugins.length > 0) {
        packages.push("@better-agent/plugins");
    }

    if (plugins.includes("sandbox")) {
        packages.push(sandboxClient === "daytona" ? "@daytonaio/sdk" : "e2b");
    }

    return packages;
};

export const requiredPackageSpecs = (selection: DependencySelection) => {
    const version = publishedVersionRange(getCliVersion());
    return requiredPackages(selection).map((name) => ({
        name,
        version:
            name in EXTERNAL_PACKAGE_VERSIONS
                ? EXTERNAL_PACKAGE_VERSIONS[name as keyof typeof EXTERNAL_PACKAGE_VERSIONS]
                : version,
    }));
};
