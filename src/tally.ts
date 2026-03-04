import { AuthorizeModule } from "./authorize";
import { BalanceModule } from "./balance";
import { resolveBaseUrl } from "./http";
import { IntentsModule } from "./intents";
import { PurchaseModule } from "./purchase";
import { WebhooksModule } from "./webhooks";
import type { PurchaseOptions, PurchaseResult, TallyConfig } from "./types";

export class Tally {
  private baseUrl: string;
  private apiKey: string;

  /** OAuth authorization flow */
  public authorize: AuthorizeModule;

  /** Purchase operations */
  public purchases: PurchaseModule;

  /** Balance operations */
  public balances: BalanceModule;

  /** Purchase intents (Buy Anywhere) */
  public intents: IntentsModule;

  /** Webhook signature verification */
  public webhooks: WebhooksModule;

  constructor(config: TallyConfig) {
    if (!config.apiKey) {
      throw new Error(
        "Tallion API key is required. Get one at https://tallion.ai/developer",
      );
    }
    this.apiKey = config.apiKey;
    this.baseUrl = resolveBaseUrl(config.apiKey, config.baseUrl);
    this.authorize = new AuthorizeModule(this.baseUrl, this.apiKey);
    this.purchases = new PurchaseModule(this.baseUrl, this.apiKey);
    this.intents = new IntentsModule(this.baseUrl, this.apiKey);
    this.balances = new BalanceModule(this.baseUrl, this.apiKey);
    this.webhooks = new WebhooksModule();
  }

  /**
   * Convenience method: Make a purchase (delegates to purchases.create).
   */
  async purchase(options: PurchaseOptions): Promise<PurchaseResult> {
    return this.purchases.create(options);
  }

  /**
   * Convenience method: Get balance for a customer.
   */
  async balance(customerToken: string, walletId?: string) {
    return this.balances.get(customerToken, walletId);
  }

  /**
   * Check if this is a sandbox instance.
   */
  get isSandbox(): boolean {
    return this.apiKey.startsWith("sk_sandbox_");
  }

  /**
   * Get the resolved base URL.
   */
  get url(): string {
    return this.baseUrl;
  }
}
