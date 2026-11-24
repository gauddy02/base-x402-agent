/**
 * Pre-flight policy checks for x402 payment requirements.
 *
 * This module does not sign, submit, verify, or settle payments. It checks
 * the terms advertised by an HTTP 402 response before an agent asks a wallet
 * to authorize anything.
 */

const BASE_NETWORKS = new Map([
  ["base", "base-mainnet"],
  ["base-mainnet", "base-mainnet"],
  ["eip155:8453", "base-mainnet"],
  ["base-sepolia", "base-sepolia"],
  ["eip155:84532", "base-sepolia"],
]);

export const BASE_USDC = Object.freeze({
  "base-mainnet": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "base-sepolia": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
});

function deny(message) {
  throw new Error(`Payment blocked by policy: ${message}`);
}

function normalizeNetwork(network) {
  if (typeof network !== "string") deny("network is missing");
  const normalized = BASE_NETWORKS.get(network.toLowerCase());
  if (!normalized) deny(`unsupported network "${network}"`);
  return normalized;
}

/**
 * Check an x402 PaymentRequirements object against explicit agent limits.
 *
 * @param {object} requirement One entry from the x402 response's accepts[].
 * @param {object} policy
 * @param {string[]} policy.allowedRecipients Required recipient address allowlist.
 * @param {string[]} [policy.allowedNetworks] Defaults to Base Sepolia only.
 * @param {string} [policy.maxAmountAtomic] Maximum USDC amount in atomic units.
 * @returns {{ network: string, amountAtomic: bigint, recipient: string, asset: string }}
 */
export function assertPaymentAllowed(requirement, policy = {}) {
  if (!requirement || typeof requirement !== "object") {
    deny("payment requirement must be an object");
  }

  if (!Array.isArray(policy.allowedRecipients) || policy.allowedRecipients.length === 0) {
    deny("configure at least one allowed recipient");
  }

  if (requirement.scheme !== "exact") {
    deny(`scheme "${requirement.scheme}" is not allowed; expected "exact"`);
  }

  const network = normalizeNetwork(requirement.network);
  const allowedNetworks = policy.allowedNetworks ?? ["base-sepolia"];
  const normalizedAllowed = allowedNetworks.map(normalizeNetwork);
  if (!normalizedAllowed.includes(network)) {
    deny(`network "${requirement.network}" is not in the configured allowlist`);
  }

  const expectedAsset = BASE_USDC[network];
  if (
    typeof requirement.asset !== "string" ||
    requirement.asset.toLowerCase() !== expectedAsset.toLowerCase()
  ) {
    deny(`asset is not the official USDC contract for ${network}`);
  }

  if (typeof requirement.payTo !== "string" || !/^0x[a-fA-F0-9]{40}$/.test(requirement.payTo)) {
    deny("payTo must be a valid EVM address");
  }

  const recipients = policy.allowedRecipients.map((address) => {
    if (typeof address !== "string" || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      deny("recipient allowlist contains an invalid EVM address");
    }
    return address.toLowerCase();
  });

  if (!recipients.includes(requirement.payTo.toLowerCase())) {
    deny(`recipient ${requirement.payTo} is not allowlisted`);
  }

  const rawAmount = requirement.maxAmountRequired ?? requirement.amount;
  if (typeof rawAmount !== "string" || !/^(0|[1-9][0-9]*)$/.test(rawAmount)) {
    deny("amount must be a non-negative integer string in USDC atomic units");
  }

  const amountAtomic = BigInt(rawAmount);
  const maxAmountAtomic = policy.maxAmountAtomic ?? "100000";
  if (typeof maxAmountAtomic !== "string" || !/^(0|[1-9][0-9]*)$/.test(maxAmountAtomic)) {
    deny("maxAmountAtomic must be a non-negative integer string");
  }

  if (amountAtomic > BigInt(maxAmountAtomic)) {
    deny(`amount ${amountAtomic} exceeds the configured limit ${maxAmountAtomic}`);
  }

  return {
    network,
    amountAtomic,
    recipient: requirement.payTo,
    asset: requirement.asset,
  };
}
