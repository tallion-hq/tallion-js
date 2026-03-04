import { request } from "./http";
import type { BalanceResult } from "./types";

export class BalanceModule {
  constructor(
    private baseUrl: string,
    private apiKey: string,
  ) {}

  /**
   * Get wallet balance for a customer (using OAuth token).
   */
  async get(customerToken: string, walletId?: string): Promise<BalanceResult> {
    const path = walletId ? `/wallets/${walletId}/budget` : "/wallets/me";
    const res = await request<{
      id?: string;
      wallet_id?: string;
      funding_amount: number;
      spent_amount: number;
      remaining: number;
    }>(this.baseUrl, path, customerToken, {
      method: "GET",
    });

    return {
      walletId: res.wallet_id || res.id || "",
      fundingAmount: res.funding_amount,
      spentAmount: res.spent_amount,
      remaining: res.remaining,
    };
  }
}
