export type TokenVerdict = "safe" | "risky" | "blocked";
export type TokenAction = "PROCEED" | "CAUTION" | "REJECT";
export type Confidence = "low" | "medium" | "high";

export interface TokenSafetyResult {
  verdict: TokenVerdict;
  action: TokenAction;
  safety_score: number;
  confidence: Confidence;
  chain: string;
  token_address: string;
  reasons: string[];
  warnings: string[];
  sources: string[];
  raw_checks: Record<string, unknown>;
  timestamp: string;
}

export interface BatchTokenSafetyResult {
  count: number;
  limit: number;
  chain: string;
  summary: Record<string, number>;
  results: TokenSafetyResult[];
  timestamp: string;
}

export interface X402Challenge {
  status: 402;
  paymentRequired: string;
  decoded?: unknown;
}

export interface ScreenTokenBatchOptions {
  chain?: string;
  tokenAddresses: string[];
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  createPaymentHeader: (challenge: X402Challenge) => Promise<string> | string;
}

export interface ScreenSingleTokenOptions {
  chain?: string;
  tokenAddress: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  createPaymentHeader: (challenge: X402Challenge) => Promise<string> | string;
}

export const DEFAULT_BASE_URL = "https://x402.fiasignals.com";
export const TOKEN_SAFETY_BATCH_PATH = "/token-safety/batch";
export const TOKEN_SAFETY_SINGLE_PATH = "/token-safety";
export const BASE_USDC_ASSET = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
export const X402_NETWORK = "eip155:8453";
export const X402_PAY_TO = "0x8D32c6a3EE3fB8a8b4c5378F7C5a26CC320a853F";
export const BATCH_AMOUNT_RAW_USDC = "100000";
export const SINGLE_AMOUNT_RAW_USDC = "30000";

const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

function requireFetch(fetchImpl?: typeof fetch): typeof fetch {
  const resolved = fetchImpl ?? globalThis.fetch;
  if (!resolved) {
    throw new Error("No fetch implementation available");
  }
  return resolved;
}

function assertAddress(address: string): void {
  if (!EVM_ADDRESS_RE.test(address)) {
    throw new Error(`Invalid EVM token address: ${address}`);
  }
}

function decodeChallenge(paymentRequired: string): unknown {
  try {
    if (typeof globalThis.atob !== "function") return undefined;
    return JSON.parse(globalThis.atob(paymentRequired));
  } catch {
    return undefined;
  }
}

async function paidGetJson<T>(
  url: URL,
  createPaymentHeader: (challenge: X402Challenge) => Promise<string> | string,
  fetchImpl?: typeof fetch,
): Promise<T> {
  const doFetch = requireFetch(fetchImpl);
  const first = await doFetch(url, { headers: { Accept: "application/json" } });

  if (first.status !== 402) {
    if (!first.ok) throw new Error(`Unexpected HTTP ${first.status}: ${await first.text()}`);
    return (await first.json()) as T;
  }

  const paymentRequired = first.headers.get("payment-required");
  if (!paymentRequired) {
    throw new Error("Received 402 without payment-required header");
  }

  const paymentHeader = await createPaymentHeader({
    status: 402,
    paymentRequired,
    decoded: decodeChallenge(paymentRequired),
  });

  const paid = await doFetch(url, {
    headers: {
      Accept: "application/json",
      "X-PAYMENT": paymentHeader,
    },
  });
  if (!paid.ok) {
    throw new Error(`Paid request failed HTTP ${paid.status}: ${await paid.text()}`);
  }
  return (await paid.json()) as T;
}

export async function screenTokenBatch(options: ScreenTokenBatchOptions): Promise<BatchTokenSafetyResult> {
  const chain = options.chain ?? "base";
  if (options.tokenAddresses.length < 1 || options.tokenAddresses.length > 5) {
    throw new Error("tokenAddresses must contain 1 to 5 EVM addresses");
  }
  for (const address of options.tokenAddresses) assertAddress(address);

  const url = new URL(TOKEN_SAFETY_BATCH_PATH, options.baseUrl ?? DEFAULT_BASE_URL);
  url.searchParams.set("chain", chain);
  url.searchParams.set("token_addresses", options.tokenAddresses.join(","));

  return paidGetJson<BatchTokenSafetyResult>(url, options.createPaymentHeader, options.fetchImpl);
}

export async function screenSingleToken(options: ScreenSingleTokenOptions): Promise<TokenSafetyResult> {
  const chain = options.chain ?? "base";
  assertAddress(options.tokenAddress);

  const url = new URL(TOKEN_SAFETY_SINGLE_PATH, options.baseUrl ?? DEFAULT_BASE_URL);
  url.searchParams.set("chain", chain);
  url.searchParams.set("token_address", options.tokenAddress);

  return paidGetJson<TokenSafetyResult>(url, options.createPaymentHeader, options.fetchImpl);
}
