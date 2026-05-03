export const APP_NAME = "Vicina by tenra";

export const APP_TAGLINE = "What's happening nearby";

export const DEFAULT_DISCOVERY_RADIUS_MILES = 3;

export const PUBLIC_ENV_KEYS = [
  "NEXT_PUBLIC_APP_NAME",
  "NEXT_PUBLIC_APP_TAGLINE",
  "NEXT_PUBLIC_API_BASE_URL",
  "NEXT_PUBLIC_MAP_PROVIDER",
  "NEXT_PUBLIC_MAP_STYLE_ID",
  "NEXT_PUBLIC_DEFAULT_LAT",
  "NEXT_PUBLIC_DEFAULT_LNG",
  "NEXT_PUBLIC_DEFAULT_RADIUS_MILES"
] as const;

export function readPublicConfig(env: Record<string, string | undefined>) {
  return {
    appName: env.NEXT_PUBLIC_APP_NAME ?? APP_NAME,
    appTagline: env.NEXT_PUBLIC_APP_TAGLINE ?? APP_TAGLINE,
    apiBaseUrl: env.NEXT_PUBLIC_API_BASE_URL ?? "",
    defaultRadiusMiles:
      Number(env.NEXT_PUBLIC_DEFAULT_RADIUS_MILES ?? DEFAULT_DISCOVERY_RADIUS_MILES) ||
      DEFAULT_DISCOVERY_RADIUS_MILES
  };
}
