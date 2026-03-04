import { request } from "./http";
import type { LegacyPurchaseOptions, PurchaseOptions, PurchaseResult } from "./types";

export class PurchaseModule {
  constructor(
    private baseUrl: string,
    private apiKey: string,
  ) {}

  /**
   * Make a purchase using an OAuth customer token.
   */
  async create(options: PurchaseOptions): Promise<PurchaseResult> {
    const res = await request<{
      transaction_id: string;
      status: string;
      decision: string;
      decision_reason: string;
      amount: number;
      merchant_name: string;
      approval_deadline?: string;
    }>(this.baseUrl, "/purchase", options.customerToken, {
      method: "POST",
      headers: {
        "X-Tallion-Installation": "", // Resolved by OAuth token
      },
      body: {
        amount: options.amount,
        currency: options.currency || "USD",
        wallet_id: options.walletId,
        merchant: {
          name: options.merchant.name,
          mcc: options.merchant.mcc || "",
          country: options.merchant.country || "US",
        },
        context: {
          description: options.context.description,
          category: options.context.category,
          line_items: options.context.lineItems,
          external_reference: options.context.externalReference,
          refund_policy: options.context.refundPolicy,
          metadata: options.context.metadata,
        },
      },
    });

    return {
      transactionId: res.transaction_id,
      status: res.status as PurchaseResult["status"],
      decision: res.decision,
      decisionReason: res.decision_reason,
      amount: res.amount,
      merchantName: res.merchant_name,
      approvalDeadline: res.approval_deadline,
    };
  }

  /**
   * Make a purchase using the legacy API key + installation ID auth.
   */
  async legacyCreate(options: LegacyPurchaseOptions): Promise<PurchaseResult> {
    const res = await request<{
      transaction_id: string;
      status: string;
      decision: string;
      decision_reason: string;
      amount: number;
      merchant_name: string;
      approval_deadline?: string;
    }>(this.baseUrl, "/purchase", this.apiKey, {
      method: "POST",
      headers: {
        "X-Tallion-Installation": options.installationId,
      },
      body: {
        amount: options.amount,
        merchant_name: options.merchantName,
        merchant_mcc: options.merchantMcc || "",
        merchant_country: options.merchantCountry || "US",
        currency: options.currency || "USD",
        wallet_id: options.walletId,
        reasoning: options.reasoning,
      },
    });

    return {
      transactionId: res.transaction_id,
      status: res.status as PurchaseResult["status"],
      decision: res.decision,
      decisionReason: res.decision_reason,
      amount: res.amount,
      merchantName: res.merchant_name,
      approvalDeadline: res.approval_deadline,
    };
  }
}
