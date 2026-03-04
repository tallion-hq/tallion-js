// ── SDK Configuration ──

export interface TallyConfig {
  apiKey: string;
  baseUrl?: string;
}

// ── Authorization ──

export interface PurchaseContext {
  amount: number;        // cents
  description: string;   // e.g. "Classic Burger"
  merchant?: string;     // e.g. "Burger Joint"
  reference?: string;    // developer's internal order ID
}

export interface CreateAuthUrlOptions {
  customerIdentifier?: string;
  redirectUrl: string;
  scopes?: string[];
  codeChallengeMethod?: "S256" | "plain";
  suggestedLimits?: SpendLimits;
  purchaseContext?: PurchaseContext;
}

export interface AuthUrlResult {
  url: string;
  state: string;
  codeVerifier: string;
  authorizationId: string;
}

export interface ExchangeCodeOptions {
  code: string;
  codeVerifier: string;
}

export interface TokenResult {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  customerId: string;
  installationId: string;
}

export interface RefreshTokenOptions {
  refreshToken: string;
}

// ── Purchase ──

export interface PurchaseOptions {
  customerToken: string;
  amount: number;
  currency?: string;
  merchant: MerchantInfo;
  context: TransactionContext;
  walletId?: string;
}

export interface LegacyPurchaseOptions {
  amount: number;
  merchantName: string;
  merchantMcc?: string;
  merchantCountry?: string;
  currency?: string;
  walletId?: string;
  reasoning?: string;
  installationId: string;
}

export interface MerchantInfo {
  name: string;
  mcc?: string;
  country?: string;
}

export interface TransactionContext {
  description: string;
  category: string;
  lineItems?: LineItem[];
  externalReference?: string;
  refundPolicy?: string;
  metadata?: Record<string, unknown>;
}

export interface LineItem {
  name: string;
  quantity: number;
  price: number;
}

export interface PurchaseResult {
  transactionId: string;
  status: "approved" | "pending_approval" | "declined";
  decision: string;
  decisionReason: string;
  amount: number;
  merchantName: string;
  approvalDeadline?: string;
}

// ── Balance ──

export interface BalanceResult {
  walletId: string;
  fundingAmount: number;
  spentAmount: number;
  remaining: number;
}

// ── Spend Limits ──

export interface SpendLimits {
  maxPerTransaction?: number;
  maxPerDay?: number;
  maxPerMonth?: number;
  requireApprovalAbove?: number;
}

// ── Webhooks ──

export interface WebhookEvent {
  event: string;
  timestamp: string;
  data: Record<string, unknown>;
}

// ── Errors ──

export interface TallionErrorData {
  status: number;
  message: string;
  code?: string;
}
