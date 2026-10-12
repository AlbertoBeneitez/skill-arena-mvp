type RateLimitBucket = {
  resetAt: number;
  count: number;
};

type RateLimitStore = {
  buckets: Map<string, RateLimitBucket>;
};

declare global {
  // eslint-disable-next-line no-var
  var __skillArenaRateLimitStore: RateLimitStore | undefined;
}

function store() {
  globalThis.__skillArenaRateLimitStore ??= {
    buckets: new Map(),
  };

  return globalThis.__skillArenaRateLimitStore;
}

export function requestRateLimitKey(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return (
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    "local"
  );
}

export function checkRateLimit(args: {
  scope: string;
  key: string;
  limit: number;
  windowMs: number;
}) {
  const now = Date.now();
  const bucketKey = `${args.scope}:${args.key}`;
  const limits = store();
  const existing = limits.buckets.get(bucketKey);

  if (!existing || existing.resetAt <= now) {
    limits.buckets.set(bucketKey, {
      resetAt: now + args.windowMs,
      count: 1,
    });

    return {
      allowed: true,
      remaining: Math.max(0, args.limit - 1),
      resetAt: now + args.windowMs,
    };
  }

  existing.count += 1;

  return {
    allowed: existing.count <= args.limit,
    remaining: Math.max(0, args.limit - existing.count),
    resetAt: existing.resetAt,
  };
}

export function rateLimitHeaders(result: {
  remaining: number;
  resetAt: number;
}) {
  return {
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
  };
}
