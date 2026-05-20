import type { Extension, Organization } from "@medplum/fhirtypes";

export const MODULE_SETTINGS_EXTENSION_URL = "https://ucc.emr/organization-enabled-module-ids";

export const DEFAULT_BRANCH_ENABLED_MODULE_IDS = [
  "appointments",
  "inventory",
  "analytics",
  "follow-up",
] as const;

export const KNOWN_BRANCH_MODULE_IDS = [
  "appointments",
  "inventory",
  "analytics",
  "follow-up",
  "tasks",
  "poct",
  "pacs",
  "triage",
] as const;

const knownModuleIds = new Set<string>(KNOWN_BRANCH_MODULE_IDS);

export function normalizeEnabledModuleIds(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [...DEFAULT_BRANCH_ENABLED_MODULE_IDS];
  }

  const normalized = input
    .map((value) => String(value).trim())
    .filter((value) => knownModuleIds.has(value));

  return Array.from(new Set(normalized));
}

export function getEnabledModuleIdsFromOrganization(org: Organization): string[] {
  const extension = org.extension?.find((ext) => ext.url === MODULE_SETTINGS_EXTENSION_URL);
  const rawValue = (extension as any)?.valueString;

  if (typeof rawValue !== "string" || !rawValue.trim()) {
    return [...DEFAULT_BRANCH_ENABLED_MODULE_IDS];
  }

  try {
    return normalizeEnabledModuleIds(JSON.parse(rawValue));
  } catch {
    return normalizeEnabledModuleIds(rawValue.split(","));
  }
}

export function withEnabledModuleIdsExtension(
  extensions: Extension[] | undefined,
  enabledModuleIds: string[] | undefined
): Extension[] | undefined {
  const otherExtensions = extensions?.filter((ext) => ext.url !== MODULE_SETTINGS_EXTENSION_URL) ?? [];

  if (!enabledModuleIds) {
    return otherExtensions.length > 0 ? otherExtensions : undefined;
  }

  return [
    ...otherExtensions,
    {
      url: MODULE_SETTINGS_EXTENSION_URL,
      valueString: JSON.stringify(normalizeEnabledModuleIds(enabledModuleIds)),
    },
  ];
}
