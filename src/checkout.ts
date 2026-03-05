import { TallionError } from "./errors";
import { request } from "./http";
import type {
  CheckoutEvent,
  CheckoutSession,
  CheckoutStep,
  CreateCheckoutOptions,
} from "./types";

export class CheckoutModule {
  constructor(
    private baseUrl: string,
    private apiKey: string,
  ) {}

  /**
   * Create a managed checkout session.
   * Tallion handles everything — browser automation, payment injection, and order confirmation.
   */
  async create(options: CreateCheckoutOptions): Promise<CheckoutSession> {
    const res = await request<RawCheckoutSession>(
      this.baseUrl,
      "/checkout",
      options.customerToken,
      {
        method: "POST",
        body: {
          product_url: options.productUrl,
          product_name: options.productName,
          product_variant: options.productVariant,
          product_price_cents: options.productPriceCents,
          quantity: options.quantity ?? 1,
          shipping: {
            name: options.shipping.name,
            line1: options.shipping.line1,
            line2: options.shipping.line2,
            city: options.shipping.city,
            state: options.shipping.state,
            zip_code: options.shipping.zipCode,
            country: options.shipping.country ?? "US",
          },
          wallet_id: options.walletId,
          amount_tolerance_pct: options.amountTolerancePct,
        },
      },
    );

    return mapSession(res);
  }

  /**
   * Get the current status of a checkout session.
   */
  async get(
    customerToken: string,
    sessionId: string,
  ): Promise<CheckoutSession> {
    const res = await request<RawCheckoutSession>(
      this.baseUrl,
      `/checkout/${sessionId}`,
      customerToken,
    );

    return mapSession(res);
  }

  /**
   * Stream real-time checkout events via SSE.
   * Uses server-sent events when available (browser / Node 18+ with EventSource polyfill),
   * with automatic polling fallback for environments without EventSource support.
   */
  async *stream(
    customerToken: string,
    sessionId: string,
  ): AsyncGenerator<CheckoutEvent> {
    const sseUrl = `${this.baseUrl}/api/checkout/${sessionId}/stream`;

    // Try SSE-based streaming first
    if (typeof EventSource !== "undefined") {
      yield* this._streamSSE(sseUrl, customerToken, sessionId);
    } else {
      yield* this._streamPolling(customerToken, sessionId);
    }
  }

  /**
   * SSE-based streaming via the /stream endpoint.
   * @internal
   */
  private async *_streamSSE(
    url: string,
    customerToken: string,
    sessionId: string,
  ): AsyncGenerator<CheckoutEvent> {
    // EventSource doesn't support custom headers, so pass token as query param
    const sseUrl = `${url}?token=${encodeURIComponent(customerToken)}`;

    // Create a queue to bridge EventSource callbacks into an async generator
    const queue: CheckoutEvent[] = [];
    let resolve: (() => void) | null = null;
    let done = false;
    let sseError: Error | null = null;

    const es = new EventSource(sseUrl);

    const enqueue = (event: CheckoutEvent) => {
      queue.push(event);
      if (resolve) {
        resolve();
        resolve = null;
      }
    };

    const handleMessage = (msgEvent: MessageEvent, eventType: string) => {
      try {
        const data = JSON.parse(msgEvent.data);
        const checkoutEvent: CheckoutEvent = {
          event: data.event ?? eventType,
          sessionId: data.sessionId ?? sessionId,
          status: data.status,
          progressPct: data.progressPct ?? 0,
          message: data.message,
          screenshotUrl: data.screenshotUrl,
          orderNumber: data.orderNumber,
          timestamp: data.timestamp ?? new Date().toISOString(),
        };
        enqueue(checkoutEvent);
      } catch {
        // Ignore unparseable events
      }
    };

    es.addEventListener("status", (e) => handleMessage(e as MessageEvent, "status"));
    es.addEventListener("complete", (e) => {
      handleMessage(e as MessageEvent, "complete");
      done = true;
      es.close();
    });
    es.addEventListener("error", (e) => {
      // If EventSource encounters an error before receiving any data,
      // fall through to let the generator terminate so caller can retry with polling
      if (queue.length === 0) {
        sseError = new Error("SSE connection failed");
        done = true;
        es.close();
        if (resolve) {
          resolve();
          resolve = null;
        }
      }
    });

    try {
      while (!done || queue.length > 0) {
        if (queue.length > 0) {
          const event = queue.shift()!;
          yield event;
          if (event.event === "complete") {
            return;
          }
        } else if (!done) {
          await new Promise<void>((r) => {
            resolve = r;
          });
        }
      }

      // If SSE failed without yielding anything, fall back to polling
      if (sseError) {
        yield* this._streamPolling(customerToken, sessionId);
      }
    } finally {
      es.close();
    }
  }

  /**
   * Polling-based fallback for environments without EventSource.
   * @internal
   */
  private async *_streamPolling(
    customerToken: string,
    sessionId: string,
  ): AsyncGenerator<CheckoutEvent> {
    let lastStatus = "";
    let lastProgress = -1;
    const terminalStatuses = new Set([
      "completed",
      "failed",
      "cancelled",
      "timeout",
      "card_declined",
      "merchant_blocked",
    ]);

    while (true) {
      const session = await this.get(customerToken, sessionId);

      if (session.status !== lastStatus || session.progressPct !== lastProgress) {
        lastStatus = session.status;
        lastProgress = session.progressPct;
        const event: CheckoutEvent = {
          event: terminalStatuses.has(session.status) ? "complete" : "status",
          sessionId: session.id,
          status: session.status,
          progressPct: session.progressPct,
          message: `Status: ${session.status}`,
          screenshotUrl: session.confirmationScreenshot,
          orderNumber: session.orderNumber,
          timestamp: new Date().toISOString(),
        };
        yield event;

        if (terminalStatuses.has(session.status)) {
          return;
        }
      }

      // Poll every 2 seconds
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  /**
   * Cancel an in-progress checkout session.
   */
  async cancel(
    customerToken: string,
    sessionId: string,
  ): Promise<CheckoutSession> {
    const res = await request<RawCheckoutSession>(
      this.baseUrl,
      `/checkout/${sessionId}/cancel`,
      customerToken,
      { method: "POST" },
    );

    return mapSession(res);
  }

  /**
   * Get the step-by-step log for a checkout session.
   */
  async steps(
    customerToken: string,
    sessionId: string,
  ): Promise<CheckoutStep[]> {
    const res = await request<RawCheckoutStep[]>(
      this.baseUrl,
      `/checkout/${sessionId}/steps`,
      customerToken,
    );

    return res.map(mapStep);
  }
}

// ── Internal helpers ──

interface RawCheckoutSession {
  id: string;
  purchase_intent_id?: string;
  status: string;
  progress_pct: number;
  product_url: string;
  product_name?: string;
  shipping_name: string;
  merchant_domain?: string;
  merchant_name?: string;
  order_number?: string;
  order_total_cents?: number;
  estimated_delivery?: string;
  tracking_number?: string;
  tracking_url?: string;
  confirmation_screenshot?: string;
  card_last_four?: string;
  error_code?: string;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
}

interface RawCheckoutStep {
  id: string;
  step_number: number;
  step_name: string;
  status: string;
  screenshot_url?: string;
  page_url?: string;
  duration_ms?: number;
  error_message?: string;
  created_at: string;
}

function mapSession(raw: RawCheckoutSession): CheckoutSession {
  return {
    id: raw.id,
    purchaseIntentId: raw.purchase_intent_id,
    status: raw.status as CheckoutSession["status"],
    progressPct: raw.progress_pct,
    productUrl: raw.product_url,
    productName: raw.product_name,
    shippingName: raw.shipping_name,
    merchantDomain: raw.merchant_domain,
    merchantName: raw.merchant_name,
    orderNumber: raw.order_number,
    orderTotalCents: raw.order_total_cents,
    estimatedDelivery: raw.estimated_delivery,
    trackingNumber: raw.tracking_number,
    trackingUrl: raw.tracking_url,
    confirmationScreenshot: raw.confirmation_screenshot,
    cardLastFour: raw.card_last_four,
    errorCode: raw.error_code,
    errorMessage: raw.error_message,
    startedAt: raw.started_at,
    completedAt: raw.completed_at,
    createdAt: raw.created_at,
  };
}

function mapStep(raw: RawCheckoutStep): CheckoutStep {
  return {
    id: raw.id,
    stepNumber: raw.step_number,
    stepName: raw.step_name,
    status: raw.status,
    screenshotUrl: raw.screenshot_url,
    pageUrl: raw.page_url,
    durationMs: raw.duration_ms,
    errorMessage: raw.error_message,
    createdAt: raw.created_at,
  };
}
