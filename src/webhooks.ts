import type { WebhookEvent } from "./types";
import { TallionError } from "./errors";

export class WebhooksModule {
  constructor(private secret?: string) {}

  /**
   * Verify a webhook signature and parse the event.
   * Uses Web Crypto API (works in Node 18+, Deno, Bun, Cloudflare Workers, etc.)
   *
   * @param body - Raw request body string
   * @param signature - Value of X-Tallion-Signature header
   * @param tolerance - Max age in seconds (default: 300 = 5 minutes)
   */
  async verify(
    body: string,
    signature: string,
    tolerance = 300,
  ): Promise<WebhookEvent> {
    if (!this.secret) {
      throw new TallionError(500, "Webhook secret not configured");
    }

    // Parse signature header: "t={timestamp},v1={hex_signature}"
    const parts: Record<string, string> = {};
    for (const part of signature.split(",")) {
      const [key, ...val] = part.split("=");
      if (key && val.length > 0) {
        parts[key] = val.join("=");
      }
    }

    const timestamp = parts["t"];
    const sig = parts["v1"];

    if (!timestamp || !sig) {
      throw new TallionError(400, "Invalid webhook signature format");
    }

    // Check timestamp freshness
    const ts = parseInt(timestamp, 10);
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - ts) > tolerance) {
      throw new TallionError(400, "Webhook timestamp expired");
    }

    // Compute HMAC-SHA256
    const message = `${timestamp}.${body}`;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(this.secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );

    const signatureBytes = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(message),
    );

    const computed = Array.from(new Uint8Array(signatureBytes))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Constant-time comparison
    if (computed.length !== sig.length || !timingSafeEqual(computed, sig)) {
      throw new TallionError(401, "Invalid webhook signature");
    }

    return JSON.parse(body) as WebhookEvent;
  }
}

/** Simple constant-time string comparison */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
