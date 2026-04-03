import prompts from "prompts";
import type { DiscoveredApp } from "./types";

export const selectDiscoveredApps = async (apps: DiscoveredApp[], yes = false) => {
    if (apps.length <= 1 || yes) return apps;

    const response = await prompts({
        type: "multiselect",
        name: "selected",
        message: "Select app export(s) to generate type(s) for (space to toggle, enter to confirm)",
        instructions: "",
        choices: apps.map((app) => ({
            title: app.label,
            value: app.label,
            selected: true,
        })),
    });

    const selectedLabels = new Set<string>(response.selected ?? []);
    return apps.filter((app) => selectedLabels.has(app.label));
};
