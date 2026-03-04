import { TallionError } from "./errors";

const SANDBOX_URL = "https://api.sandbox.tallion.ai";
const PRODUCTION_URL = "https://api.tallion.ai";

export function resolveBaseUrl(apiKey: string, overrideUrl?: string): string {
  if (overrideUrl) return overrideUrl;
  if (apiKey.startsWith("sk_live_")) return PRODUCTION_URL;
  return SANDBOX_URL;
}

export interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
}

export async function request<T>(
  baseUrl: string,
  path: string,
  apiKey: string,
  options: RequestOptions = {},
): Promise<T> {
  if (!apiKey) {
    throw new TallionError(
      401,
      "Tallion API key is required. Get one at https://tallion.ai/developer",
      "missing_api_key",
    );
  }
  const url = `${baseUrl}/api${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
    ...options.headers,
  };

  const res = await fetch(url, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new TallionError(
      res.status,
      body.error || "Request failed",
      body.code,
    );
  }

  return res.json() as Promise<T>;
}
