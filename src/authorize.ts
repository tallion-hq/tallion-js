import { request } from "./http";
import type {
  AuthUrlResult,
  CreateAuthUrlOptions,
  ExchangeCodeOptions,
  RefreshTokenOptions,
  TokenResult,
} from "./types";

/** Generate a random string for PKCE */
function generateRandomString(length: number): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => chars[byte % chars.length]).join("");
}

/** SHA-256 hash for PKCE S256 challenge */
async function sha256(plain: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export class AuthorizeModule {
  constructor(
    private baseUrl: string,
    private apiKey: string,
  ) {}

  /**
   * Create an authorization URL for customer consent.
   * Returns the URL to open in a popup/browser plus the PKCE code verifier.
   */
  async createUrl(options: CreateAuthUrlOptions): Promise<AuthUrlResult> {
    const codeVerifier = generateRandomString(64);
    const codeChallenge = await sha256(codeVerifier);

    const res = await request<{
      authorization_id: string;
      url: string;
      state: string;
    }>(this.baseUrl, "/oauth/authorize", this.apiKey, {
      method: "POST",
      body: {
        customer_identifier: options.customerIdentifier,
        redirect_url: options.redirectUrl,
        scopes: options.scopes || ["purchase", "balance:read"],
        code_challenge: codeChallenge,
        code_challenge_method: options.codeChallengeMethod || "S256",
        suggested_limits: options.suggestedLimits
          ? {
              max_per_transaction: options.suggestedLimits.maxPerTransaction,
              max_per_day: options.suggestedLimits.maxPerDay,
              max_per_month: options.suggestedLimits.maxPerMonth,
              require_approval_above: options.suggestedLimits.requireApprovalAbove,
            }
          : undefined,
        purchase_context: options.purchaseContext
          ? {
              amount: options.purchaseContext.amount,
              description: options.purchaseContext.description,
              merchant: options.purchaseContext.merchant,
              reference: options.purchaseContext.reference,
            }
          : undefined,
      },
    });

    return {
      url: res.url,
      state: res.state,
      codeVerifier,
      authorizationId: res.authorization_id,
    };
  }

  /**
   * Exchange an authorization code for access + refresh tokens.
   */
  async exchangeCode(options: ExchangeCodeOptions): Promise<TokenResult> {
    const res = await request<{
      access_token: string;
      refresh_token: string;
      token_type: string;
      expires_in: number;
      customer_id: string;
      installation_id: string;
    }>(this.baseUrl, "/oauth/token", this.apiKey, {
      method: "POST",
      body: {
        grant_type: "authorization_code",
        code: options.code,
        code_verifier: options.codeVerifier,
      },
    });

    return {
      accessToken: res.access_token,
      refreshToken: res.refresh_token,
      tokenType: res.token_type,
      expiresIn: res.expires_in,
      customerId: res.customer_id,
      installationId: res.installation_id,
    };
  }

  /**
   * Refresh an access token using a refresh token.
   */
  async refreshToken(options: RefreshTokenOptions): Promise<TokenResult> {
    const res = await request<{
      access_token: string;
      refresh_token: string;
      token_type: string;
      expires_in: number;
      customer_id: string;
      installation_id: string;
    }>(this.baseUrl, "/oauth/token", this.apiKey, {
      method: "POST",
      body: {
        grant_type: "refresh_token",
        refresh_token: options.refreshToken,
      },
    });

    return {
      accessToken: res.access_token,
      refreshToken: res.refresh_token,
      tokenType: res.token_type,
      expiresIn: res.expires_in,
      customerId: res.customer_id,
      installationId: res.installation_id,
    };
  }

  /**
   * Revoke an access or refresh token.
   */
  async revoke(token: string): Promise<void> {
    await request(this.baseUrl, "/oauth/revoke", this.apiKey, {
      method: "POST",
      body: { token },
    });
  }
}
