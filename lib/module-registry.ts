"use server";

import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import type { ComponentType } from "react";
import { notFound } from "next/navigation";
import { MODULES } from "@/lib/modules";
import { getAdminMedplum } from "@/lib/server/medplum-admin";
import { resolveClinicIdFromServerScope } from "@/lib/server/clinic";
import {
  getEnabledModuleIdsFromOrganization,
  DEFAULT_BRANCH_ENABLED_MODULE_IDS,
  KNOWN_BRANCH_MODULE_IDS,
} from "@/lib/module-settings";

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

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 150;

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

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const pageModule = await pageConfig.load();
      return pageModule.default;
    } catch (error) {
      if (isNotFoundError(error) && attempt === MAX_RETRIES) {
        return null;
      }
      if (!isNotFoundError(error) && !isWebpackChunkError(error)) {
        throw error;
      }
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
      }
    }
  }

  return null;
}

export async function listActiveModules(): Promise<ModuleDefinition[]> {
  const moduleIds = await getInstalledModuleIds();
  const definitions = await Promise.all(moduleIds.map((moduleId) => loadModuleDefinition(moduleId)));
  return definitions.filter((definition): definition is ModuleDefinition => Boolean(definition));
}

export async function getEnabledModuleIdsForClinic(clinicId?: string | null): Promise<string[]> {
  if (!clinicId) {
    return [...DEFAULT_BRANCH_ENABLED_MODULE_IDS];
  }

  try {
    const medplum = await getAdminMedplum();
    const orgs = await medplum.searchResources("Organization", {
      identifier: `clinic|${clinicId}`,
      _count: "1",
    });
    const org = orgs?.[0];
    return org ? getEnabledModuleIdsFromOrganization(org) : [...DEFAULT_BRANCH_ENABLED_MODULE_IDS];
  } catch {
    return [...DEFAULT_BRANCH_ENABLED_MODULE_IDS];
  }
}

export async function isModuleEnabledForClinic(
  moduleId: string,
  clinicId?: string | null
): Promise<boolean> {
  const enabledModuleIds = await getEnabledModuleIdsForClinic(clinicId);
  return enabledModuleIds.includes(moduleId);
}

export async function listActiveModulesForClinic(
  clinicId?: string | null
): Promise<ModuleDefinition[]> {
  const [modules, enabledModuleIds] = await Promise.all([
    listActiveModules(),
    getEnabledModuleIdsForClinic(clinicId),
  ]);
  return modules.filter((module) => enabledModuleIds.includes(module.id));
}

export async function listNavigationModulesForClinic(
  clinicId?: string | null
): Promise<ModuleDefinition[]> {
  const [registeredModules, enabledModuleIds] = await Promise.all([
    listActiveModules(),
    getEnabledModuleIdsForClinic(clinicId),
  ]);
  const registeredById = new Map(registeredModules.map((module) => [module.id, module]));

  return enabledModuleIds
    .map((moduleId) => {
      const registeredModule = registeredById.get(moduleId);
      if (registeredModule) {
        return registeredModule;
      }

      const legacyModule = MODULES[moduleId as keyof typeof MODULES];
      if (!legacyModule?.route) {
        return null;
      }

      return {
        id: legacyModule.id,
        label: legacyModule.name,
        description: legacyModule.description,
        routePath: legacyModule.route,
        icon: legacyModule.icon,
        pages: {},
      } satisfies ModuleDefinition;
    })
    .filter((module): module is ModuleDefinition => Boolean(module));
}

export async function listAvailableBranchModules(): Promise<ModuleDefinition[]> {
  const registeredModules = await listActiveModules();
  const registeredById = new Map(registeredModules.map((module) => [module.id, module]));
  const moduleIds = Array.from(
    new Set([...KNOWN_BRANCH_MODULE_IDS, ...registeredModules.map((module) => module.id)])
  );

  return moduleIds
    .map((moduleId) => {
      const registeredModule = registeredById.get(moduleId);
      if (registeredModule) {
        return registeredModule;
      }

      const legacyModule = MODULES[moduleId as keyof typeof MODULES];
      if (!legacyModule) {
        return null;
      }

      return {
        id: legacyModule.id,
        label: legacyModule.name,
        description: legacyModule.description,
        routePath: legacyModule.route ?? "",
        icon: legacyModule.icon,
        pages: {},
      } satisfies ModuleDefinition;
    })
    .filter((module): module is ModuleDefinition => Boolean(module));
}

export async function loadEnabledModulePage(
  moduleId: string,
  pageKey = "default",
  clinicId?: string | null
): Promise<ComponentType<any> | null> {
  const targetClinicId = clinicId === undefined
    ? await resolveClinicIdFromServerScope()
    : clinicId;
  const enabled = await isModuleEnabledForClinic(moduleId, targetClinicId);
  if (!enabled) {
    return null;
  }

  return loadModulePage(moduleId, pageKey);
}

export async function assertModuleEnabledForCurrentClinic(moduleId: string): Promise<void> {
  const clinicId = await resolveClinicIdFromServerScope();
  const enabled = await isModuleEnabledForClinic(moduleId, clinicId);
  if (!enabled) {
    notFound();
  }
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

function isWebpackChunkError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const message = String("message" in error ? (error as { message?: unknown }).message : "");
  return (
    message.includes("Cannot read properties of undefined") ||
    message.includes("Loading chunk") ||
    message.includes("ChunkLoadError")
  );
}
