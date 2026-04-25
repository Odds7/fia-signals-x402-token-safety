# Fia Signals x402 Token Safety Client

Screen up to 5 Base tokens before swap for 0.10 USDC via x402.

This client package is a buyer-agent integration example for the Fia Signals
token safety endpoint:

- Batch risk gate: `GET https://x402.fiasignals.com/token-safety/batch`
- Single-token fallback: `GET https://x402.fiasignals.com/token-safety`
- Settlement: x402 over Base USDC
- Batch price: `0.10 USDC`
- Single price: `0.03 USDC`
- Live data sources: GoPlus token security and DexScreener market data
- Stubbed until keys exist: De.Fi and Bubblemaps

Use it when an autonomous trading agent, swap router, rebalancer, or market bot
needs a machine-readable pre-swap verdict before touching a token.

## Discovery

The live batch endpoint is indexed in CDP x402 Bazaar discovery. Buyer agents can
find it through merchant lookup for pay-to
`0x8D32c6a3EE3fB8a8b4c5378F7C5a26CC320a853F`.

Current discovery proof is merchant-indexed. Broad semantic search ranking is
still empirical and should not be treated as guaranteed placement.

Pinned live x402 challenge constants:

| Field | Value |
| --- | --- |
| Network | `eip155:8453` |
| Asset | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Pay-to | `0x8D32c6a3EE3fB8a8b4c5378F7C5a26CC320a853F` |
| Batch amount | `100000` raw USDC |
| Single amount | `30000` raw USDC |

## Quick Start

```ts
import { screenTokenBatch } from "@fia-signals/x402-token-safety";

const result = await screenTokenBatch({
  chain: "base",
  tokenAddresses: [
    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "0x4200000000000000000000000000000000000006",
  ],
  createPaymentHeader: async (challenge) => {
    // Use your x402 wallet/client here, then return the X-PAYMENT header.
    return signX402Challenge(challenge);
  },
});

for (const token of result.results) {
  if (token.verdict === "blocked") throw new Error("Do not trade");
  if (token.verdict === "risky") console.warn("Reduce size or require confirmation");
}
```

Python:

```py
from fia_x402_token_safety import screen_token_batch

result = screen_token_batch(
    token_addresses=[
        "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        "0x4200000000000000000000000000000000000006",
    ],
    create_payment_header=lambda challenge: sign_x402_challenge(challenge),
)
```

## Response Contract

Single-token checks return:

```json
{
  "verdict": "safe|risky|blocked",
  "action": "PROCEED|CAUTION|REJECT",
  "safety_score": 0,
  "confidence": "low|medium|high",
  "reasons": [],
  "warnings": [],
  "sources": [],
  "raw_checks": {}
}
```

Batch checks return:

```json
{
  "count": 2,
  "limit": 5,
  "chain": "base",
  "summary": {"safe": 1, "risky": 1, "blocked": 0, "error": 0},
  "results": [],
  "timestamp": "2026-04-25T00:00:00+00:00"
}
```

The frozen local contract artifact is:

`business/revenue-streams/signals-api/data/x402_token_safety_response_contract.json`

## No-Spend Regression Gate

Before publishing this client or running a paid canary:

```bash
python3 business/revenue-streams/signals-api/x402_contract_regression.py
```

That gate verifies all four paid paths, prices, Base USDC asset, pay-to address,
invalid-input rejection before payment, discovery docs, plugin logo, and funnel
probe filtering.

## Endpoint Matrix

| Path | Price | Use |
| --- | ---: | --- |
| `/token-safety/batch` | 0.10 USDC | Primary buyer-agent route, up to 5 Base tokens |
| `/pre-trade-risk/batch` | 0.10 USDC | Batch alias |
| `/token-safety` | 0.03 USDC | Single-token fallback |
| `/pre-trade-risk` | 0.03 USDC | Single-token alias |

## Important

This repository does not hide wallet logic. It exposes a payment-header hook:
your agent supplies the x402 wallet implementation, receives the challenge, and
returns the `X-PAYMENT` header for the paid retry.

The examples are no-spend by default: they stop at the x402 challenge unless a
real wallet/client is wired into the payment-header hook.
