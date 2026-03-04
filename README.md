# @tallion/sdk

TypeScript SDK for [Tallion](https://tallion.ai) — AI agent spend control.

Give your AI agents the ability to make purchases with built-in guardrails: spend limits, approval flows, and full transaction context.

## Install

```bash
npm install @tallion/sdk
```

## Quick start

```typescript
import { Tally } from "@tallion/sdk";

const tally = new Tally({ apiKey: process.env.TALLION_API_KEY! });
// sk_sandbox_* → sandbox, sk_live_* → production (auto-detected)
```

## Authorization

Before an agent can spend on behalf of a customer, the customer must authorize it through Tallion's hosted OAuth flow with PKCE.

### 1. Create an authorization URL (server-side)

```typescript
const { url, state, codeVerifier } = await tally.authorize.createUrl({
  customerIdentifier: "+1234567890", // phone or email
  redirectUrl: "https://yourapp.com/callback",
  scopes: ["purchase", "balance:read"],
  suggestedLimits: {
    maxPerTransaction: 10000, // $100.00 (cents)
    maxPerDay: 50000,
    requireApprovalAbove: 25000,
  },
});

// Store state + codeVerifier in your session, then open `url` as a popup
```

### 2. Exchange the code (callback handler)

```typescript
const { accessToken, refreshToken, customerId, installationId } =
  await tally.authorize.exchangeCode({
    code: req.query.code,
    codeVerifier: storedCodeVerifier,
  });

// Store accessToken securely — this is what you pass to purchase/balance calls
```

### 3. Refresh tokens

```typescript
const tokens = await tally.authorize.refreshToken({
  refreshToken: storedRefreshToken,
});
```

### 4. Revoke access

```typescript
await tally.authorize.revoke(accessToken);
```

## Purchases

```typescript
const tx = await tally.purchase({
  customerToken: accessToken,
  amount: 2500, // $25.00 in cents
  merchant: {
    name: "Delta Airlines",
    mcc: "3000",
    country: "US",
  },
  context: {
    description: "Round-trip flight NYC → LAX, March 15",
    category: "travel",
    lineItems: [{ name: "Economy seat", quantity: 1, price: 2500 }],
    externalReference: "booking-abc-123",
    refundPolicy: "Non-refundable",
    metadata: { flightNumber: "DL 1234" },
  },
});

// tx.status: "approved" | "pending_approval" | "declined"
console.log(tx.transactionId, tx.status, tx.decisionReason);
```

## Balance

```typescript
const balance = await tally.balance(accessToken);

console.log(balance.remaining); // cents remaining in wallet
console.log(balance.fundingAmount); // total funded
console.log(balance.spentAmount); // total spent
```

## Webhooks

Verify incoming webhook signatures using HMAC-SHA256. Works in Node 18+, Deno, Bun, and Cloudflare Workers (uses Web Crypto API).

```typescript
import { Tally } from "@tallion/sdk";

const tally = new Tally({ apiKey: process.env.TALLION_API_KEY! });

// In your webhook handler
app.post("/webhooks/tallion", async (req, res) => {
  const event = await tally.webhooks.verify(
    req.body, // raw body string
    req.headers["x-tally-signature"],
  );

  switch (event.event) {
    case "transaction.approved":
      // Handle approved transaction
      break;
    case "transaction.declined":
      // Handle declined transaction
      break;
    case "approval.approved":
      // Customer approved a pending transaction
      break;
    case "dispute.created":
      // Customer filed a dispute
      break;
  }

  res.json({ received: true });
});
```

### Webhook events

| Event | Description |
|---|---|
| `transaction.approved` | Transaction was approved |
| `transaction.declined` | Transaction was declined by policy |
| `transaction.pending_approval` | Transaction requires customer approval |
| `approval.approved` | Customer approved a pending transaction |
| `approval.declined` | Customer declined a pending transaction |
| `approval.expired` | Approval request expired |
| `dispute.created` | Customer opened a dispute |
| `dispute.resolved` | Dispute was resolved |
| `authorization.completed` | Customer completed the OAuth flow |
| `authorization.revoked` | Customer revoked agent access |

## Error handling

```typescript
import { Tally, TallionError } from "@tallion/sdk";

try {
  const tx = await tally.purchase({ ... });
} catch (err) {
  if (err instanceof TallionError) {
    console.error(err.status);  // HTTP status code
    console.error(err.message); // Error description
    console.error(err.code);    // Error code (e.g. "insufficient_funds")
  }
}
```

## Sandbox vs production

| | Sandbox | Production |
|---|---|---|
| API key prefix | `sk_sandbox_*` | `sk_live_*` |
| Base URL | `api.sandbox.tallion.ai` | `api.tallion.ai` |
| SMS verification | Code `123456` always works | Real SMS via Twilio |
| Transactions | Simulated | Real card network |
| Funding | Plaid Sandbox institutions | Real bank accounts |

The SDK auto-detects the environment from your API key — no configuration needed.

## Requirements

- Node.js 18+ (or any runtime with `fetch` and `crypto.subtle`)
- Zero runtime dependencies

## License

MIT
