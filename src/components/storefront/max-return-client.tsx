"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { clearMessengerLaunchContext } from "@/lib/messenger-client";

type ClaimState = "checking" | "success" | "error";

type ClaimResult = {
  mode: "login" | "register";
  redirectTo: string;
  phone: string;
  user: { id: string; role: string; name: string } | null;
};

function isStandalonePwa() {
  if (typeof window === "undefined") {
    return false;
  }

  const navigatorWithStandalone = window.navigator as Navigator & {
    standalone?: boolean;
  };

  return Boolean(
    navigatorWithStandalone.standalone ||
      window.matchMedia("(display-mode: standalone)").matches,
  );
}

export function MaxReturnClient({
  state,
  token,
}: {
  state: string;
  token: string;
}) {
  const router = useRouter();
  const [claimState, setClaimState] = useState<ClaimState>("checking");
  const [message, setMessage] = useState("Проверяем подтверждение MAX...");
  const [result, setResult] = useState<ClaimResult | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function claimReturn() {
      if (!state || !token) {
        setClaimState("error");
        setMessage(
          "Ссылка возврата неполная. Откройте АлексФрут и запустите вход через MAX ещё раз.",
        );
        return;
      }

      try {
        const response = await fetch("/api/auth/max/claim-return", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ state, token }),
        });
        const payload = await response.json();

        if (cancelled) {
          return;
        }

        if (!response.ok) {
          setClaimState("error");
          setMessage(
            payload.error ??
              "Не удалось завершить возврат из MAX. Откройте приложение и попробуйте ещё раз.",
          );
          return;
        }

        const claimResult = payload as ClaimResult;
        clearMessengerLaunchContext(state);
        setResult(claimResult);
        setClaimState("success");

        if (isStandalonePwa()) {
          router.replace(claimResult.redirectTo);
          router.refresh();
          return;
        }

        setMessage(
          claimResult.mode === "login"
            ? "Вход через MAX завершён в браузере. Если вы устанавливали АлексФрут на экран домой, откройте приложение там — оно также завершит вход автоматически."
            : "Телефон подтверждён. Можно продолжить регистрацию в браузере или открыть установленное приложение АлексФрут.",
        );
      } catch (error) {
        if (cancelled) {
          return;
        }

        setClaimState("error");
        setMessage(
          error instanceof Error
            ? error.message
            : "Не удалось завершить возврат из MAX.",
        );
      }
    }

    void claimReturn();

    return () => {
      cancelled = true;
    };
  }, [router, state, token]);

  return (
    <div className="space-y-5">
      <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted)]">
        MAX
      </p>
      <h1 className="font-serif text-4xl font-semibold sm:text-5xl">
        Возвращаем вас в АлексФрут
      </h1>
      <p className="text-[var(--muted)]">{message}</p>

      {claimState === "checking" && (
        <div className="h-2 overflow-hidden rounded-full bg-emerald-100">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-[var(--accent)]" />
        </div>
      )}

      {claimState === "success" && result && !isStandalonePwa() && (
        <div className="space-y-3">
          <Button
            className="w-full"
            onClick={() => {
              router.replace(result.redirectTo);
              router.refresh();
            }}
          >
            Продолжить в браузере
          </Button>
          <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900 ring-1 ring-emerald-100">
            Чтобы открыть именно установленное PWA, закройте этот экран и нажмите
            иконку АлексФрут на домашнем экране.
          </p>
        </div>
      )}

      {claimState === "error" && (
        <Button className="w-full" onClick={() => router.replace("/login")}>
          Вернуться ко входу
        </Button>
      )}
    </div>
  );
}
