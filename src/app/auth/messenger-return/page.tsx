import { MainShell } from "@/components/layout/main-shell";
import { MessengerReturnClient } from "@/components/storefront/messenger-return-client";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

type MessengerReturnPageProps = {
  searchParams: Promise<{
    messengerChallengeId?: string | string[];
  }>;
};

export default async function MessengerReturnPage({
  searchParams,
}: MessengerReturnPageProps) {
  const user = await getCurrentUser();
  const params = await searchParams;
  const rawChallengeId = params.messengerChallengeId;
  const challengeId = Array.isArray(rawChallengeId)
    ? rawChallengeId[0] ?? ""
    : rawChallengeId ?? "";

  return (
    <MainShell user={user}>
      <section className="section-shell min-h-[calc(100vh-8rem)] py-8">
        <div className="mx-auto max-w-xl glass-panel rounded-[2.5rem] p-8">
          <MessengerReturnClient challengeId={challengeId} />
        </div>
      </section>
    </MainShell>
  );
}
