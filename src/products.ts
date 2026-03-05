import { request } from "./http";
import type {
  ExtractedIntent,
  Product,
  ProductSearchOptions,
  ProductSearchResult,
} from "./types";

export class ProductsModule {
  constructor(
    private baseUrl: string,
    private apiKey: string,
  ) {}

  /**
   * Search for products across all stores.
   * Returns real results with prices, images, delivery estimates, and trust scores.
   */
  async search(
    query: string,
    options?: ProductSearchOptions,
  ): Promise<ProductSearchResult> {
    const res = await request<RawSearchResponse>(
      this.baseUrl,
      "/products/search",
      this.apiKey,
      {
        method: "POST",
        body: {
          query,
          max_results: options?.maxResults ?? 20,
          min_trust_score: options?.minTrustScore,
          max_price_cents: options?.maxPriceCents,
          store: options?.store,
          natural_language: options?.naturalLanguage,
        },
      },
    );

    return {
      products: res.products.map(mapProduct),
      query: res.query,
      total: res.total,
      extractedIntent: res.extracted_intent
        ? mapExtractedIntent(res.extracted_intent)
        : undefined,
    };
  }

  /**
   * Get a specific product by ID.
   */
  async get(customerToken: string, productId: string): Promise<Product> {
    const res = await request<RawProduct>(
      this.baseUrl,
      `/products/${productId}`,
      customerToken,
    );

    return mapProduct(res);
  }
}

// ── Internal helpers ──

interface RawProduct {
  id: string;
  name: string;
  price_cents: number;
  currency: string;
  store: string;
  url: string;
  image_url?: string;
  rating?: number;
  review_count?: number;
  delivery_estimate?: string;
  in_stock: boolean;
  trust_score: number;
  trust_breakdown?: Record<string, unknown>;
}

interface RawExtractedIntent {
  keyword: string;
  max_price_cents?: number;
  store?: string;
  intent_tags: string[];
  intent_summary?: string;
}

interface RawSearchResponse {
  products: RawProduct[];
  query: string;
  total: number;
  extracted_intent?: RawExtractedIntent;
}

function mapProduct(raw: RawProduct): Product {
  return {
    id: raw.id,
    name: raw.name,
    priceCents: raw.price_cents,
    currency: raw.currency,
    store: raw.store,
    url: raw.url,
    imageUrl: raw.image_url,
    rating: raw.rating,
    reviewCount: raw.review_count,
    deliveryEstimate: raw.delivery_estimate,
    inStock: raw.in_stock,
    trustScore: raw.trust_score,
    trustBreakdown: raw.trust_breakdown,
  };
}

function mapExtractedIntent(raw: RawExtractedIntent): ExtractedIntent {
  return {
    keyword: raw.keyword,
    maxPriceCents: raw.max_price_cents,
    store: raw.store,
    intentTags: raw.intent_tags,
    intentSummary: raw.intent_summary,
  };
}
