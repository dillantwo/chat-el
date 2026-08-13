/**
 * Token cost calculation.
 *
 * Storage semantics (Option B — mutually exclusive buckets):
 *
 *   promptTokens      = NON-cached input tokens   -> charged at full input rate
 *   cachedInputTokens = cached input tokens        -> charged at the cache rate
 *
 *   total input tokens = promptTokens + cachedInputTokens
 *
 * The two fields never overlap, so cost is a straight sum — no subtraction.
 * (Note: this means promptTokens + completionTokens != totalTokens, because
 * totalTokens still holds Azure's raw total which includes the cached input.)
 */

/** Price per 1,000,000 tokens, in USD. */
export interface ModelPricing {
  /** Full-rate input tokens (the part that was NOT served from cache). */
  input: number;
  /** Cached input tokens (prompt cache hits). Usually a discount on `input`. */
  cachedInput: number;
  /** Output / completion tokens. */
  output: number;
}

/**
 * Pricing table, USD per 1M tokens. Standard (pay-as-you-go) Azure OpenAI rates.
 *
 * ⚠️ Verify against the current Azure pricing page before trusting these for
 * billing — provider prices change. Last checked: 2026-06.
 *   - https://azure.microsoft.com/en-us/pricing/details/azure-openai/
 *
 * Keys are normalized (lowercased) deployment/model names. Add deployment
 * aliases here if your Azure deployment name differs from the base model name.
 */
export const MODEL_PRICING: Record<string, ModelPricing> = {
  "gpt-4.1": { input: 2.0, cachedInput: 0.5, output: 8.0 },
  "gpt-4o": { input: 2.5, cachedInput: 1.25, output: 10.0 },
  // GPT-5 family caches at 10% of the input rate. Used by /api/generate-html.
  "gpt-5.3-codex": { input: 1.75, cachedInput: 0.175, output: 14.0 },
  // Embedding models: input-only, no prompt cache, no completion. Used by the
  // RAG retrieval step. Without these entries embedding tokens would fall back
  // to chat pricing and overstate RAG cost by ~100x.
  // Rates cross-checked 2026-08 against OpenAI's embedding price announcement
  // (https://openai.com/blog/new-embedding-models-and-api-updates/) and
  // https://costgoat.com/pricing/openai-embeddings
  "text-embedding-3-small": { input: 0.02, cachedInput: 0.02, output: 0 },
  "text-embedding-3-large": { input: 0.13, cachedInput: 0.13, output: 0 },
  "text-embedding-ada-002": { input: 0.1, cachedInput: 0.1, output: 0 },
};

/** Used when a model name has no entry in MODEL_PRICING. */
export const DEFAULT_PRICING: ModelPricing = MODEL_PRICING["gpt-4o"];

/** A subset of the TokenUsage document needed to compute cost. */
export interface UsageLike {
  modelName?: string | null;
  /** Non-cached input tokens (excludes cached). */
  promptTokens?: number | null;
  /** Cached input tokens. */
  cachedInputTokens?: number | null;
  completionTokens?: number | null;
}

export interface CostBreakdown {
  /** The pricing actually applied. */
  pricing: ModelPricing;
  /** Input tokens billed at the full rate (promptTokens - cachedInputTokens). */
  nonCachedInputTokens: number;
  /** Input tokens billed at the cached rate. */
  cachedInputTokens: number;
  /** Output tokens. */
  outputTokens: number;
  /** USD cost of the non-cached input portion. */
  nonCachedInputCost: number;
  /** USD cost of the cached input portion. */
  cachedInputCost: number;
  /** USD cost of the output. */
  outputCost: number;
  /** Total USD cost. */
  totalCost: number;
}

/** Look up pricing for a model name (case-insensitive), falling back to default. */
export function getPricing(modelName?: string | null): ModelPricing {
  if (!modelName) return DEFAULT_PRICING;
  return MODEL_PRICING[modelName.toLowerCase()] ?? DEFAULT_PRICING;
}

const PER_MILLION = 1_000_000;

/**
 * Compute the USD cost of a single usage record.
 *
 * With Option B storage, promptTokens is already the non-cached portion and
 * cachedInputTokens is the cached portion, so the two are billed directly with
 * no subtraction.
 */
export function calculateUsageCost(usage: UsageLike): CostBreakdown {
  const pricing = getPricing(usage.modelName);

  const nonCachedInputTokens = Math.max(0, usage.promptTokens ?? 0);
  const cachedInputTokens = Math.max(0, usage.cachedInputTokens ?? 0);
  const completionTokens = Math.max(0, usage.completionTokens ?? 0);

  const nonCachedInputCost = (nonCachedInputTokens * pricing.input) / PER_MILLION;
  const cachedInputCost = (cachedInputTokens * pricing.cachedInput) / PER_MILLION;
  const outputCost = (completionTokens * pricing.output) / PER_MILLION;

  return {
    pricing,
    nonCachedInputTokens,
    cachedInputTokens,
    outputTokens: completionTokens,
    nonCachedInputCost,
    cachedInputCost,
    outputCost,
    totalCost: nonCachedInputCost + cachedInputCost + outputCost,
  };
}

export interface CostSummary {
  /** Total input tokens = nonCachedInputTokens + cachedInputTokens. */
  totalInputTokens: number;
  cachedInputTokens: number;
  nonCachedInputTokens: number;
  completionTokens: number;
  nonCachedInputCost: number;
  cachedInputCost: number;
  outputCost: number;
  totalCost: number;
  /** How much was saved by cache hits vs paying full input rate for them. */
  cacheSavings: number;
}

/** Sum the cost across many usage records. */
export function summarizeUsageCost(records: UsageLike[]): CostSummary {
  const summary: CostSummary = {
    totalInputTokens: 0,
    cachedInputTokens: 0,
    nonCachedInputTokens: 0,
    completionTokens: 0,
    nonCachedInputCost: 0,
    cachedInputCost: 0,
    outputCost: 0,
    totalCost: 0,
    cacheSavings: 0,
  };

  for (const record of records) {
    const b = calculateUsageCost(record);
    summary.totalInputTokens += b.nonCachedInputTokens + b.cachedInputTokens;
    summary.cachedInputTokens += b.cachedInputTokens;
    summary.nonCachedInputTokens += b.nonCachedInputTokens;
    summary.completionTokens += b.outputTokens;
    summary.nonCachedInputCost += b.nonCachedInputCost;
    summary.cachedInputCost += b.cachedInputCost;
    summary.outputCost += b.outputCost;
    summary.totalCost += b.totalCost;
    // What the cached tokens would have cost at full input rate, minus what they
    // actually cost at the cache rate.
    summary.cacheSavings +=
      (b.cachedInputTokens * (b.pricing.input - b.pricing.cachedInput)) /
      PER_MILLION;
  }

  return summary;
}
