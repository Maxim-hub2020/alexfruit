type SmokeCheck = {
  name: string;
  path: string;
  allowedStatuses?: number[];
};

const baseUrl = (
  process.env.SMOKE_BASE_URL ||
  process.env.APP_URL ||
  "http://127.0.0.1:3000"
).replace(/\/$/, "");

const checks: SmokeCheck[] = [
  { name: "home storefront", path: "/", allowedStatuses: [200, 307, 308] },
  { name: "login flow", path: "/login", allowedStatuses: [200, 307, 308] },
  { name: "registration flow", path: "/register", allowedStatuses: [200, 307, 308] },
  { name: "categories API", path: "/api/categories", allowedStatuses: [200] },
  { name: "products API", path: "/api/products", allowedStatuses: [200] },
  { name: "current user API", path: "/api/auth/me", allowedStatuses: [200, 401] },
];

async function runCheck(check: SmokeCheck) {
  const url = `${baseUrl}${check.path}`;
  const response = await fetch(url, {
    redirect: "manual",
    signal: AbortSignal.timeout(12_000),
  });
  const allowedStatuses = check.allowedStatuses ?? [200];

  if (!allowedStatuses.includes(response.status)) {
    throw new Error(
      `${check.name}: expected ${allowedStatuses.join(", ")}, got ${response.status}`,
    );
  }

  if (response.status >= 500) {
    throw new Error(`${check.name}: server error ${response.status}`);
  }

  return { ...check, status: response.status };
}

async function main() {
  console.log(`Smoke checks against ${baseUrl}`);

  for (const check of checks) {
    const result = await runCheck(check);
    console.log(`ok ${result.status} ${result.name}`);
  }
}

main().catch((error) => {
  console.error(
    [
      "Smoke check failed.",
      "Start the app first, for example: npm run build && npm run start",
      error instanceof Error ? error.message : String(error),
    ].join("\n"),
  );
  process.exitCode = 1;
});
