"use client";

import { useEffect, useRef, useState } from "react";
import { Crosshair, LoaderCircle, MapPin, TriangleAlert } from "lucide-react";

const MIN_SEND_INTERVAL_MS = 15000;

type ShareStatus = "idle" | "active" | "error" | "unsupported";

function getErrorMessage(error: GeolocationPositionError) {
  if (error.code === error.PERMISSION_DENIED) {
    return "Геолокация отключена. Включите доступ к местоположению для передачи координат.";
  }

  if (error.code === error.POSITION_UNAVAILABLE) {
    return "Не удалось определить местоположение. Проверьте GPS и интернет.";
  }

  return "Геолокация отвечает слишком долго. Попробуйте ещё раз.";
}

export function CourierLocationShare({
  hasActiveTasks,
}: {
  hasActiveTasks: boolean;
}) {
  const watchIdRef = useRef<number | null>(null);
  const lastSentAtRef = useRef(0);
  const [status, setStatus] = useState<ShareStatus>("idle");
  const [message, setMessage] = useState(
    "Передавайте координаты, когда выходите на доставку.",
  );
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null && "geolocation" in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  async function sendPosition(position: GeolocationPosition) {
    const now = Date.now();

    if (now - lastSentAtRef.current < MIN_SEND_INTERVAL_MS) {
      return;
    }

    lastSentAtRef.current = now;

    const response = await fetch("/api/courier/location", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      }),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(payload?.error ?? "Не удалось отправить геолокацию.");
    }

    setLastUpdatedAt(new Date().toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
    }));
  }

  function startSharing() {
    if (!("geolocation" in navigator)) {
      setStatus("unsupported");
      setMessage("На этом устройстве нет доступа к геолокации.");
      return;
    }

    setStatus("active");
    setMessage("Геолокация включена. Координаты обновляются автоматически.");

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        sendPosition(position).catch((error: Error) => {
          setStatus("error");
          setMessage(error.message);
        });
      },
      (error) => {
        setStatus("error");
        setMessage(getErrorMessage(error));
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 20000,
      },
    );
  }

  function stopSharing() {
    if (watchIdRef.current !== null && "geolocation" in navigator) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    setStatus("idle");
    setMessage("Передача координат остановлена.");
  }

  const isActive = status === "active";
  const isDisabled = !hasActiveTasks && !isActive;

  return (
    <section className="glass-panel rounded-[2rem] p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
            {isActive ? (
              <LoaderCircle size={21} className="animate-spin" />
            ) : (
              <Crosshair size={21} />
            )}
          </div>
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-[var(--muted)]">
              Геолокация
            </p>
            <h2 className="mt-1 text-2xl font-semibold">
              Положение курьера на карте
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              {message}
              {lastUpdatedAt ? ` Последнее обновление: ${lastUpdatedAt}.` : ""}
            </p>
            {!hasActiveTasks && (
              <p className="mt-2 flex gap-2 text-xs text-amber-700">
                <TriangleAlert size={14} className="mt-0.5 shrink-0" />
                Активных точек нет, включать передачу координат обычно не нужно.
              </p>
            )}
          </div>
        </div>

        <button
          type="button"
          disabled={isDisabled}
          onClick={isActive ? stopSharing : startSharing}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] px-5 text-sm font-semibold text-white shadow-[0_16px_30px_rgba(47,143,79,0.2)] disabled:cursor-not-allowed disabled:bg-[var(--muted)]"
        >
          <MapPin size={17} />
          {isActive ? "Остановить" : "Включить геолокацию"}
        </button>
      </div>
    </section>
  );
}
