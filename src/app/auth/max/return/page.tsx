import { MainShell } from "@/components/layout/main-shell";
import { MaxReturnClient } from "@/components/storefront/max-return-client";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

type MaxReturnPageProps = {
  searchParams: Promise<{
    state?: string | string[];
    token?: string | string[];
  }>;
};

function readSingleParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function MaxReturnPage({ searchParams }: MaxReturnPageProps) {
  const user = await getCurrentUser();
  const params = await searchParams;
  const state = readSingleParam(params.state).trim();
  const token = readSingleParam(params.token).trim();

  return (
    <MainShell user={user}>
      <section className="section-shell min-h-[calc(100vh-8rem)] py-8">
        <div className="mx-auto max-w-xl glass-panel rounded-[2.5rem] p-8">
          <MaxReturnClient state={state} token={token} />
        </div>
      </section>
    </MainShell>
  );
}
