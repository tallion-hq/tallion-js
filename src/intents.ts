import { request } from "./http";
import type {
  CreateIntentOptions,
  IntentResult,
  IntentStatusResult,
  ListIntentsOptions,
} from "./types";

export class IntentsModule {
  constructor(
    private baseUrl: string,
    private apiKey: string,
  ) {}

  /**
   * Create a purchase intent (Buy Anywhere).
   * Returns a virtual card for the customer to use at the merchant.
   */
  async create(options: CreateIntentOptions): Promise<IntentResult> {
    const res = await request<{
      intent_id: string;
      status: string;
      amount: number;
      currency: string;
      merchant_name?: string;
      expires_at?: string;
      transaction_id?: string;
      card?: {
        pan: string;
        cvv: string;
        exp_month: number;
        exp_year: number;
        last_four: string;
      };
    }>(this.baseUrl, "/intents", options.customerToken, {
      method: "POST",
      body: {
        amount: options.amount,
        currency: options.currency || "USD",
        wallet_id: options.walletId,
        merchant: options.merchant
          ? {
              name: options.merchant.name,
              url: options.merchant.url,
              mcc: options.merchant.mcc,
            }
          : undefined,
        product: options.product
          ? {
              description: options.product.description,
              url: options.product.url,
            }
          : undefined,
        amount_tolerance_pct: options.amountTolerancePct,
      },
    });

    return {
      intentId: res.intent_id,
      status: res.status as IntentResult["status"],
      amount: res.amount,
      currency: res.currency,
      merchantName: res.merchant_name,
      expiresAt: res.expires_at,
      transactionId: res.transaction_id,
      card: res.card
        ? {
            pan: res.card.pan,
            cvv: res.card.cvv,
            expMonth: res.card.exp_month,
            expYear: res.card.exp_year,
            lastFour: res.card.last_four,
          }
        : undefined,
    };
  }

  /**
   * Get the current status of a purchase intent.
   */
  async get(
    customerToken: string,
    intentId: string,
  ): Promise<IntentStatusResult> {
    const res = await request<RawIntentStatus>(
      this.baseUrl,
      `/intents/${intentId}`,
      customerToken,
    );

    return mapIntentStatus(res);
  }

  /**
   * Cancel an active purchase intent.
   */
  async cancel(
    customerToken: string,
    intentId: string,
  ): Promise<IntentStatusResult> {
    const res = await request<RawIntentStatus>(
      this.baseUrl,
      `/intents/${intentId}/cancel`,
      customerToken,
      { method: "POST" },
    );

    return mapIntentStatus(res);
  }

  /**
   * List purchase intents for the authenticated customer.
   */
  async list(
    customerToken: string,
    options?: ListIntentsOptions,
  ): Promise<IntentStatusResult[]> {
    const params = new URLSearchParams();
    if (options?.limit !== undefined) params.set("limit", String(options.limit));
    if (options?.offset !== undefined)
      params.set("offset", String(options.offset));

    const query = params.toString();
    const path = query ? `/intents?${query}` : "/intents";

    const res = await request<RawIntentStatus[]>(
      this.baseUrl,
      path,
      customerToken,
    );

    return res.map(mapIntentStatus);
  }
}

// ── Internal helpers ──

interface RawIntentStatus {
  intent_id: string;
  status: string;
  amount: number;
  currency: string;
  merchant_name?: string;
  card_last_four?: string;
  asa_verified: boolean;
  asa_amount?: number;
  asa_merchant_descriptor?: string;
  asa_mismatch_reason?: string;
  transaction_id?: string;
  expires_at?: string;
  created_at: string;
}

function mapIntentStatus(raw: RawIntentStatus): IntentStatusResult {
  return {
    intentId: raw.intent_id,
    status: raw.status,
    amount: raw.amount,
    currency: raw.currency,
    merchantName: raw.merchant_name,
    cardLastFour: raw.card_last_four,
    asaVerified: raw.asa_verified,
    asaAmount: raw.asa_amount,
    asaMerchantDescriptor: raw.asa_merchant_descriptor,
    asaMismatchReason: raw.asa_mismatch_reason,
    transactionId: raw.transaction_id,
    expiresAt: raw.expires_at,
    createdAt: raw.created_at,
  };
}
