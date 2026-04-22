const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);
const FALSE_VALUES = new Set(["0", "false", "no", "off"]);

function parseBooleanFlag(value: string | undefined, defaultValue: boolean): boolean {
  if (typeof value === "undefined" || value === null) {
    return defaultValue;
  }

  const normalized = value.toLowerCase().trim();
  if (TRUE_VALUES.has(normalized)) {
    return true;
  }

  if (FALSE_VALUES.has(normalized)) {
    return false;
  }

  return defaultValue;
}

export const SOAP_REWRITE_ENABLED = parseBooleanFlag(
  process.env.NEXT_PUBLIC_FEATURE_SOAP_REWRITE,
  true
);

export const TRANSCRIBE_ENABLED = parseBooleanFlag(
  process.env.NEXT_PUBLIC_FEATURE_TRANSCRIBE,
  false
);

export function getFeatureFlags() {
  return {
    soapRewrite: SOAP_REWRITE_ENABLED,
    transcribe: TRANSCRIBE_ENABLED,
  } as const;
}
