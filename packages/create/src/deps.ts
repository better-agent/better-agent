import { readFileSync } from "node:fs";
import path from "node:path";
import type { PluginId, ProviderId } from "./types";

type DependencySelection = {
    providers: ProviderId[];
    plugins: PluginId[];
};

type PackageJsonVersion = {
    version?: string;
};

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

export const requiredPackages = ({ plugins }: DependencySelection) => {
    const packages = ["@better-agent/core", "@better-agent/client", "@better-agent/providers"];
    if (plugins.length > 0) {
        packages.push("@better-agent/plugins");
    }
    return packages;
};

export const requiredPackageSpecs = (selection: DependencySelection) => {
    const version = publishedVersionRange(getCliVersion());
    return requiredPackages(selection).map((name) => ({ name, version }));
};
