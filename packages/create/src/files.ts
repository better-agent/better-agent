import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { FileResult, TargetFile } from "./types";

export const ensureDirectory = (dirPath: string) => {
    mkdirSync(dirPath, { recursive: true });
};

export const copyDirectory = (fromDir: string, toDir: string) => {
    ensureDirectory(path.dirname(toDir));
    cpSync(fromDir, toDir, { recursive: true });
};

export const createPackageJson = (cwd: string): FileResult => {
    const packageJsonPath = path.join(cwd, "package.json");
    if (existsSync(packageJsonPath)) {
        return { label: "package.json", kind: "exists" };
    }

    const packageName =
        path
            .basename(cwd)
            .toLowerCase()
            .replace(/[^a-z0-9-]+/g, "-")
            .replace(/-+/g, "-")
            .replace(/^-|-$/g, "") || "better-agent-app";
    const packageJson = {
        name: packageName,
        private: true,
        type: "module",
        devDependencies: {
            "@types/node": "^22.10.2",
            typescript: "^5.9.3",
        },
    };

    mkdirSync(path.dirname(packageJsonPath), { recursive: true });
    writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");
    return { label: "package.json", kind: "created" };
};

export type PackageDependencySpec = {
    name: string;
    version: string;
};

export const updatePackageDependencies = (
    cwd: string,
    packages: PackageDependencySpec[],
): FileResult => {
    const packageJsonPath = path.join(cwd, "package.json");
    const raw = readFileSync(packageJsonPath, "utf8");
    const pkg = JSON.parse(raw) as { dependencies?: Record<string, string> };
    const dependencies = { ...(pkg.dependencies ?? {}) };

    let changed = false;
    for (const { name, version } of packages) {
        if (dependencies[name]) continue;
        dependencies[name] = version;
        changed = true;
    }

    if (!changed) {
        return { label: "package.json", kind: "skipped" };
    }

    pkg.dependencies = Object.fromEntries(
        Object.entries(dependencies).sort(([a], [b]) => a.localeCompare(b)),
    );
    writeFileSync(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
    return { label: "package.json", kind: "updated" };
};

export const writeTargetFiles = (files: TargetFile[]): FileResult[] => {
    const results: FileResult[] = [];

    for (const file of files) {
        const alreadyExists = existsSync(file.path);
        if (alreadyExists && !file.overwrite) {
            results.push({ label: file.label, kind: "exists" });
            continue;
        }

        mkdirSync(path.dirname(file.path), { recursive: true });
        writeFileSync(file.path, file.content, "utf8");
        results.push({
            label: file.label,
            kind: alreadyExists && file.overwrite ? "updated" : "created",
        });
    }

    return results;
};

export const updateEnvFile = (cwd: string, snippet: string): FileResult => {
    const envPath = path.join(cwd, ".env");
    const incomingLines = snippet.split(/\r?\n/).filter(Boolean);

    if (!existsSync(envPath)) {
        writeFileSync(envPath, `${snippet}\n`, "utf8");
        return { label: ".env", kind: "created" };
    }

    const current = readFileSync(envPath, "utf8");
    const existingKeys = new Set<string>();
    for (const line of current.split(/\r?\n/)) {
        const match = line.match(/^\s*([A-Z0-9_]+)\s*=/);
        if (match?.[1]) {
            existingKeys.add(match[1]);
        }
    }
    const linesToAppend = incomingLines.filter((line) => {
        const match = line.match(/^([A-Z0-9_]+)=/);
        return match?.[1] ? !existingKeys.has(match[1]) : !current.includes(line);
    });

    if (linesToAppend.length === 0) {
        return { label: ".env", kind: "skipped" };
    }

    const prefix = current.endsWith("\n") || current.length === 0 ? "" : "\n";
    writeFileSync(envPath, `${current}${prefix}${linesToAppend.join("\n")}\n`, "utf8");
    return { label: ".env", kind: "updated" };
};

export const updateGitignore = (cwd: string): FileResult => {
    const gitignorePath = path.join(cwd, ".gitignore");
    const entry = ".env";

    if (!existsSync(gitignorePath)) {
        writeFileSync(gitignorePath, `${entry}\n`, "utf8");
        return { label: ".gitignore", kind: "created" };
    }

    const current = readFileSync(gitignorePath, "utf8");
    const lines = new Set(current.split(/\r?\n/).map((line: string) => line.trim()));
    if (lines.has(entry)) {
        return { label: ".gitignore", kind: "skipped" };
    }

    const prefix = current.endsWith("\n") || current.length === 0 ? "" : "\n";
    writeFileSync(gitignorePath, `${current}${prefix}${entry}\n`, "utf8");
    return { label: ".gitignore", kind: "updated" };
};
