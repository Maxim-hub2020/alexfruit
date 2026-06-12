"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  canCompleteMessengerReturn,
  clearMessengerLaunchContext,
  messengerReturnWrongContextMessage,
} from "@/lib/messenger-client";

type ReturnState = "checking" | "wrong-context" | "pending" | "error";

function getRedirectByRole(role: string) {
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

export function MessengerReturnClient({ challengeId }: { challengeId: string }) {
  const router = useRouter();
  const [state, setState] = useState<ReturnState>("checking");
  const [message, setMessage] = useState("Проверяем подтверждение телефона...");

  useEffect(() => {
    let cancelled = false;

    async function completeReturn() {
      if (!challengeId) {
        setState("error");
        setMessage("Не нашли код подтверждения. Вернитесь в приложение и начните вход заново.");
        return;
      }

      if (!canCompleteMessengerReturn(challengeId)) {
        setState("wrong-context");
        setMessage(messengerReturnWrongContextMessage);
        return;
      }

      try {
        const statusResponse = await fetch(`/api/auth/messenger/status/${challengeId}`, {
          cache: "no-store",
        });
        const status = await statusResponse.json();

        if (cancelled) {
          return;
        }

        if (!statusResponse.ok) {
          setState("error");
          setMessage(status.error ?? "Не удалось проверить подтверждение телефона.");
          return;
        }

        if (status.status !== "VERIFIED") {
          setState("pending");
          setMessage("Подтверждение ещё завершается. Вернитесь в MAX и поделитесь телефоном.");
          return;
        }

        const completeResponse = await fetch("/api/auth/messenger/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: challengeId }),
        });
        const completeResult = await completeResponse.json();

        if (cancelled) {
          return;
        }

        if (!completeResponse.ok) {
          setState("error");
          setMessage(completeResult.error ?? "Не удалось завершить вход через MAX.");
          return;
        }

        clearMessengerLaunchContext(challengeId);
        router.replace(getRedirectByRole(completeResult.role));
        router.refresh();
      } catch (error) {
        if (cancelled) {
          return;
        }

        setState("error");
        setMessage(
          error instanceof Error
            ? error.message
            : "Не удалось завершить вход через MAX.",
        );
      }
    }

    void completeReturn();

    return () => {
      cancelled = true;
    };
  }, [challengeId, router]);

  const canRetry = state === "pending" || state === "error";

  return (
    <div className="space-y-5">
      <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted)]">
        MAX
      </p>
      <h1 className="font-serif text-4xl font-semibold sm:text-5xl">
        Возвращаем вас в АлексФрут
      </h1>
      <p className="text-[var(--muted)]">{message}</p>

      {state === "wrong-context" && (
        <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900 ring-1 ring-emerald-100">
          Если приложение уже открыто на iPhone, просто переключитесь обратно в него.
          АлексФрут сам увидит подтверждение и войдёт в аккаунт.
        </div>
      )}

      {canRetry && (
        <Button onClick={() => router.refresh()} className="w-full">
          Проверить ещё раз
        </Button>
      )}
    </div>
  );
}
