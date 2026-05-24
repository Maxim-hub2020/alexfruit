"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LogoutButton({
  className,
  label = "Выйти из профиля",
}: {
  className?: string;
  label?: string;
}) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function logout() {
    setIsLoading(true);

    await fetch("/api/auth/logout", {
      method: "POST",
    });

    router.push("/login");
    router.refresh();
  }

  return (
    <Button
      variant="ghost"
      className={cn(
        "w-full justify-center text-rose-700 ring-rose-100 hover:bg-rose-50",
        className,
      )}
      onClick={() => logout()}
      disabled={isLoading}
    >
      {isLoading ? "Выходим..." : label}
    </Button>
  );
}
