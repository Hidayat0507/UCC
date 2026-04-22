"use server";

import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import type { ComponentType } from "react";

export type ModulePageLoader = () => Promise<ModulePageModule>;

export type ModulePageModule = {
  default: ComponentType<any>;
};

export type ModulePageConfig = {
  title?: string;
  description?: string;
  load: ModulePageLoader;
};

export type ModuleDefinition = {
  id: string;
  label: string;
  description?: string;
  routePath: string;
  pages: Record<string, ModulePageConfig>;
  icon?: string;
};

const modulesDirectory = path.join(process.cwd(), "modules");

export async function getInstalledModuleIds(): Promise<string[]> {
  if (!existsSync(modulesDirectory)) {
    return [];
  }

  return readdirSync(modulesDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter((entry) => !existsSync(path.join(modulesDirectory, entry.name, ".disabled")))
    .map((entry) => entry.name);
}

export async function loadModuleDefinition(moduleId: string): Promise<ModuleDefinition | null> {
  if (!moduleId || !/^[a-z0-9-]+$/i.test(moduleId)) {
    return null;
  }

  if (!existsSync(path.join(modulesDirectory, moduleId))) {
    return null;
  }

  try {
    const moduleConfig = await import(
      /* webpackMode: "lazy", webpackChunkName: "module-config-[request]" */
      `@/modules/${moduleId}/module.config`
    );

    return moduleConfig.default as ModuleDefinition;
  } catch (error) {
    if (isNotFoundError(error)) {
      return null;
    }

    throw error;
  }
}

export async function loadModulePage(
  moduleId: string,
  pageKey = "default"
): Promise<ComponentType<any> | null> {
  const definition = await loadModuleDefinition(moduleId);
  if (!definition) {
    return null;
  }

  const pageConfig = definition.pages?.[pageKey];
  if (!pageConfig) {
    return null;
  }

  try {
    const pageModule = await pageConfig.load();
    return pageModule.default;
  } catch (error) {
    if (isNotFoundError(error)) {
      return null;
    }

    throw error;
  }
}

export async function listActiveModules(): Promise<ModuleDefinition[]> {
  const moduleIds = await getInstalledModuleIds();
  const definitions = await Promise.all(moduleIds.map((moduleId) => loadModuleDefinition(moduleId)));
  return definitions.filter((definition): definition is ModuleDefinition => Boolean(definition));
}

function isNotFoundError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  if ("code" in error && (error as { code?: string }).code === "MODULE_NOT_FOUND") {
    return true;
  }

  const message = String("message" in error ? (error as { message?: unknown }).message : "");
  return message.includes("Cannot find module");
}
