import test from "node:test";
import assert from "node:assert/strict";
import { assertPaymentAllowed, BASE_USDC } from "../src/payment-policy.js";

const recipient = "0x1111111111111111111111111111111111111111";
const otherRecipient = "0x2222222222222222222222222222222222222222";

const policy = {
  allowedRecipients: [recipient],
  allowedNetworks: ["base-sepolia"],
  maxAmountAtomic: "25000",
};

function requirement(overrides = {}) {
  return {
    scheme: "exact",
    network: "base-sepolia",
    maxAmountRequired: "10000",
    asset: BASE_USDC["base-sepolia"],
    payTo: recipient,
    ...overrides,
  };
}

test("allows an exact USDC payment on Base Sepolia within policy", () => {
  const result = assertPaymentAllowed(requirement(), policy);
  assert.equal(result.network, "base-sepolia");
  assert.equal(result.amountAtomic, 10000n);
  assert.equal(result.recipient, recipient);
});

test("accepts the Base Sepolia CAIP-2 network identifier and v2 amount field", () => {
  const result = assertPaymentAllowed(
    requirement({ network: "eip155:84532", maxAmountRequired: undefined, amount: "25000" }),
    policy,
  );
  assert.equal(result.amountAtomic, 25000n);
});

test("blocks payments above the configured spend limit", () => {
  assert.throws(
    () => assertPaymentAllowed(requirement({ maxAmountRequired: "25001" }), policy),
    /exceeds the configured limit/,
  );
});

test("blocks recipients that are not explicitly allowlisted", () => {
  assert.throws(
    () => assertPaymentAllowed(requirement({ payTo: otherRecipient }), policy),
    /not allowlisted/,
  );
});

test("blocks networks outside the configured allowlist", () => {
  assert.throws(
    () => assertPaymentAllowed(
      requirement({ network: "base", asset: BASE_USDC["base-mainnet"] }),
      policy,
    ),
    /not in the configured allowlist/,
  );
});

test("blocks a token that is not Base Sepolia USDC", () => {
  assert.throws(
    () => assertPaymentAllowed(requirement({ asset: "0x3333333333333333333333333333333333333333" }), policy),
    /official USDC contract/,
  );
});

test("blocks non-exact payment schemes", () => {
  assert.throws(
    () => assertPaymentAllowed(requirement({ scheme: "upto" }), policy),
    /expected "exact"/,
  );
});

test("requires an explicit recipient allowlist", () => {
  assert.throws(
    () => assertPaymentAllowed(requirement(), {}),
    /configure at least one allowed recipient/,
  );
});

test("rejects malformed or non-integer amounts", () => {
  assert.throws(
    () => assertPaymentAllowed(requirement({ maxAmountRequired: "1.5" }), policy),
    /non-negative integer string/,
  );
});
