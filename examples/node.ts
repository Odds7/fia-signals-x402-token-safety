import { screenTokenBatch } from "../src/index.js";

async function signX402Challenge(challenge: unknown): Promise<string> {
  console.error("x402 challenge:", JSON.stringify(challenge, null, 2));
  throw new Error("Wire this to your x402 wallet/client and return the X-PAYMENT header.");
}

const result = await screenTokenBatch({
  tokenAddresses: [
    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "0x4200000000000000000000000000000000000006",
  ],
  createPaymentHeader: signX402Challenge,
});

console.log(JSON.stringify(result, null, 2));
