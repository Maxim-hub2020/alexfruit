import { jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";

const AUTH_COOKIE_NAME = "alexfrut-session";
const TOO_MANY_REQUESTS_MESSAGE = "Too many requests. Please try again later.";

type RateLimitPolicy = {
  name: string;
  max: number;
  windowMs: number;
};

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const routeRules = [
  { prefix: "/profile", roles: ["CUSTOMER", "ADMIN"] },
  { prefix: "/orders", roles: ["CUSTOMER", "ADMIN"] },
  { prefix: "/admin", roles: ["ADMIN"] },
  { prefix: "/courier", roles: ["COURIER"] },
  { prefix: "/picker", roles: ["PICKER"] },
] as const;

const staffBlockedPagePrefixes = [
  "/",
  "/catalog",
  "/cart",
  "/orders",
  "/profile",
  "/products",
  "/register",
  "/shared-cart",
] as const;

const rateLimitStore = new Map<string, RateLimitBucket>();

function readPositiveInt(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

const maxBuckets = readPositiveInt("RATE_LIMIT_MAX_BUCKETS", 5000);
const policies = {
  auth: {
    name: "auth",
    max: readPositiveInt("RATE_LIMIT_AUTH_MAX", 8),
    windowMs: readPositiveInt("RATE_LIMIT_AUTH_WINDOW_MS", 60_000),
  },
  orders: {
    name: "orders",
    max: readPositiveInt("RATE_LIMIT_ORDERS_MAX", 25),
    windowMs: readPositiveInt("RATE_LIMIT_ORDERS_WINDOW_MS", 60_000),
  },
  staff: {
    name: "staff",
    max: readPositiveInt("RATE_LIMIT_STAFF_MAX", 120),
    windowMs: readPositiveInt("RATE_LIMIT_STAFF_WINDOW_MS", 60_000),
  },
  api: {
    name: "api",
    max: readPositiveInt("RATE_LIMIT_API_MAX", 180),
    windowMs: readPositiveInt("RATE_LIMIT_API_WINDOW_MS", 60_000),
  },
  page: {
    name: "page",
    max: readPositiveInt("RATE_LIMIT_PAGE_MAX", 240),
    windowMs: readPositiveInt("RATE_LIMIT_PAGE_WINDOW_MS", 60_000),
  },
} satisfies Record<string, RateLimitPolicy>;

function getSecret() {
  return new TextEncoder().encode(
    process.env.JWT_SECRET ?? "local-development-secret-change-me",
  );
}

function getHomeForRole(role: string) {
  if (role === "ADMIN") {
    return "/admin";
  }

  if (role === "COURIER") {
    return "/courier";
  }

  if (role === "PICKER") {
    return "/picker";
  }

  return "/";
}

function isStaffBlockedPage(pathname: string) {
  return staffBlockedPagePrefixes.some((prefix) => {
    if (prefix === "/") {
      return pathname === "/";
    }

    return pathname === prefix || pathname.startsWith(`${prefix}/`);
  });
}

function getClientIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");

  return forwardedFor?.split(",")[0]?.trim() || realIp || "local";
}

function getRateLimitPolicy(pathname: string): RateLimitPolicy {
  if (
    pathname === "/api/auth/login" ||
    pathname.startsWith("/api/auth/login/") ||
    pathname === "/api/auth/register" ||
    pathname.startsWith("/api/auth/register/") ||
    pathname.startsWith("/api/auth/max/") ||
    pathname.startsWith("/api/auth/messenger/")
  ) {
    return policies.auth;
  }

  if (pathname === "/api/orders" || pathname.startsWith("/api/orders/")) {
    return policies.orders;
  }

  if (
    pathname.startsWith("/api/admin/") ||
    pathname.startsWith("/api/courier/") ||
    pathname.startsWith("/api/picker/")
  ) {
    return policies.staff;
  }

  if (pathname.startsWith("/api/")) {
    return policies.api;
  }

  return policies.page;
}

function pruneRateLimitStore(now: number) {
  if (rateLimitStore.size <= maxBuckets) {
    return;
  }

  for (const [key, bucket] of rateLimitStore.entries()) {
    if (bucket.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }

  if (rateLimitStore.size > maxBuckets) {
    rateLimitStore.clear();
  }
}

function addSecurityHeaders(response: NextResponse) {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(self)");
  return response;
}

function setRateLimitHeaders(
  response: NextResponse,
  policy: RateLimitPolicy,
  bucket: RateLimitBucket,
  now: number,
) {
  response.headers.set("X-RateLimit-Policy", policy.name);
  response.headers.set("X-RateLimit-Limit", String(policy.max));
  response.headers.set("X-RateLimit-Remaining", String(Math.max(0, policy.max - bucket.count)));
  response.headers.set("X-RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));

  if (bucket.count > policy.max) {
    response.headers.set("Retry-After", String(Math.ceil((bucket.resetAt - now) / 1000)));
  }

  return response;
}

function checkRateLimit(request: NextRequest) {
  const now = Date.now();
  const policy = getRateLimitPolicy(request.nextUrl.pathname);
  const key = `${policy.name}:${getClientIp(request)}`;
  const existingBucket = rateLimitStore.get(key);
  const bucket =
    existingBucket && existingBucket.resetAt > now
      ? { ...existingBucket, count: existingBucket.count + 1 }
      : { count: 1, resetAt: now + policy.windowMs };

  rateLimitStore.set(key, bucket);
  pruneRateLimitStore(now);

  if (bucket.count <= policy.max) {
    return { allowed: true, policy, bucket, now };
  }

  return { allowed: false, policy, bucket, now };
}

function buildTooManyRequestsResponse(
  request: NextRequest,
  policy: RateLimitPolicy,
  bucket: RateLimitBucket,
  now: number,
) {
  const isApiRequest = request.nextUrl.pathname.startsWith("/api/");
  const response = isApiRequest
    ? NextResponse.json({ error: TOO_MANY_REQUESTS_MESSAGE }, { status: 429 })
    : new NextResponse(TOO_MANY_REQUESTS_MESSAGE, { status: 429 });

  return addSecurityHeaders(setRateLimitHeaders(response, policy, bucket, now));
}

function finalizeResponse(
  response: NextResponse,
  policy: RateLimitPolicy,
  bucket: RateLimitBucket,
  now: number,
) {
  return addSecurityHeaders(setRateLimitHeaders(response, policy, bucket, now));
}

export async function proxy(request: NextRequest) {
  const rateLimit = checkRateLimit(request);
  const pathname = request.nextUrl.pathname;

  if (!rateLimit.allowed) {
    return buildTooManyRequestsResponse(
      request,
      rateLimit.policy,
      rateLimit.bucket,
      rateLimit.now,
    );
  }

  const rule = routeRules.find(({ prefix }) =>
    pathname.startsWith(prefix),
  );

  if (!rule && !isStaffBlockedPage(pathname)) {
    return finalizeResponse(
      NextResponse.next(),
      rateLimit.policy,
      rateLimit.bucket,
      rateLimit.now,
    );
  }

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    if (!rule) {
      return finalizeResponse(
        NextResponse.next(),
        rateLimit.policy,
        rateLimit.bucket,
        rateLimit.now,
      );
    }

    return finalizeResponse(
      NextResponse.redirect(new URL("/login", request.url)),
      rateLimit.policy,
      rateLimit.bucket,
      rateLimit.now,
    );
  }

  try {
    const { payload } = await jwtVerify(token, getSecret());
    const role = String(payload.role ?? "");

    if ((role === "COURIER" || role === "PICKER") && isStaffBlockedPage(pathname)) {
      return finalizeResponse(
        NextResponse.redirect(new URL(getHomeForRole(role), request.url)),
        rateLimit.policy,
        rateLimit.bucket,
        rateLimit.now,
      );
    }

    if (rule && !rule.roles.some((allowedRole) => allowedRole === role)) {
      return finalizeResponse(
        NextResponse.redirect(new URL(getHomeForRole(role), request.url)),
        rateLimit.policy,
        rateLimit.bucket,
        rateLimit.now,
      );
    }

    return finalizeResponse(
      NextResponse.next(),
      rateLimit.policy,
      rateLimit.bucket,
      rateLimit.now,
    );
  } catch {
    if (!rule) {
      return finalizeResponse(
        NextResponse.next(),
        rateLimit.policy,
        rateLimit.bucket,
        rateLimit.now,
      );
    }

    return finalizeResponse(
      NextResponse.redirect(new URL("/login", request.url)),
      rateLimit.policy,
      rateLimit.bucket,
      rateLimit.now,
    );
  }
}

export const config = {
  matcher: [
    "/api/:path*",
    "/((?!api|_next/static|_next/image|_next/webpack-hmr|favicon.ico|brand|.*\\..*).*)",
  ],
};
