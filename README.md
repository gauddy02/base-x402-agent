# Base x402 Agent

A small, Base-focused starter for an AI agent that can interact with x402-protected APIs.

This repository currently provides a **payment pre-flight safety layer**. Before an agent asks a wallet to sign an x402 payment, it can check the advertised payment terms against explicit rules:

- Only the `exact` payment scheme is accepted.
- Only Base Mainnet and Base Sepolia are recognized.
- The token must be the official USDC contract for the selected Base network.
- The recipient must be in an explicit allowlist.
- The amount must stay below a configurable limit (USDC has 6 decimals).

The policy supports both common x402 network identifiers (`base` / `base-sepolia`) and CAIP-2 identifiers (`eip155:8453` / `eip155:84532`). It reads the v1 `maxAmountRequired` field and the v2 `amount` field.

## Requirements

- Node.js 20 or newer
- npm

## Run the tests

```bash
npm test
```

GitHub Actions runs the same test command on pull requests targeting `main` and on branch pushes.

## Use the policy

```js
import { assertPaymentAllowed } from "./src/payment-policy.js";

const policy = {
  // Always set this to the wallet(s) or merchant(s) your agent trusts.
  allowedRecipients: ["0x1111111111111111111111111111111111111111"],

  // Start on testnet. Add "base-mainnet" only after reviewing your setup.
  allowedNetworks: ["base-sepolia"],

  // 25,000 atomic USDC units = 0.025 USDC.
  maxAmountAtomic: "25000",
};

const paymentRequirement = {
  scheme: "exact",
  network: "base-sepolia",
  maxAmountRequired: "10000",
  asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  payTo: "0x1111111111111111111111111111111111111111",
};

const approved = assertPaymentAllowed(paymentRequirement, policy);
console.log("Payment terms approved:", approved);
```

If a requirement violates policy, the function throws an error. The caller should stop and must not request a signature.

## Safety notes

- This is a **pre-flight policy check**, not payment verification or settlement.
- It does not create signatures, send transactions, or hold private keys.
- Never put private keys or seed phrases in source code or commit them to Git.
- Treat payment requirements from an HTTP 402 response as untrusted input.
- Keep the recipient allowlist and spend limit under your control.
- Run on Base Sepolia first. Mainnet use should be an explicit configuration change.

## Next steps

1. Connect this guard to an x402 client such as the official `@x402/fetch` integration.
2. Add a wallet adapter only after the policy approves a payment requirement.
3. Add transaction receipt logging and a per-day spending budget.

## References

- [x402 protocol repository](https://github.com/x402-foundation/x402)
- [x402 v1 specification](https://github.com/x402-foundation/x402/blob/main/specs/x402-specification-v1.md)
- [x402 v2 specification](https://github.com/x402-foundation/x402/blob/main/specs/x402-specification-v2.md)
- [Coinbase CDP x402 examples](https://github.com/coinbase/cdp-sdk/tree/main/examples/typescript/x402)
- [Base](https://base.org)
