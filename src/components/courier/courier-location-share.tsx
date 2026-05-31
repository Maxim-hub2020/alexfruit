"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Crosshair, LoaderCircle, RadioTower, TriangleAlert } from "lucide-react";
import { COURIER_LOCATION_REFRESH_INTERVAL_MS } from "@/lib/location-refresh";

type ShareStatus = "idle" | "updating" | "active" | "error" | "unsupported";

function getErrorMessage(error: GeolocationPositionError) {
  if (error.code === error.PERMISSION_DENIED) {
    return "Доступ к геолокации запрещен. Разрешите сайту использовать местоположение в настройках браузера.";
  }

  if (error.code === error.POSITION_UNAVAILABLE) {
    return "Не удалось определить местоположение. Проверьте GPS и интернет.";
  }

  return "Геолокация отвечает слишком долго. Повторим попытку автоматически.";
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CourierLocationShare({
  hasActiveTasks,
}: {
  hasActiveTasks: boolean;
}) {
  const isMountedRef = useRef(false);
  const requestInFlightRef = useRef(false);
  const lastSentAtRef = useRef(0);
  const [status, setStatus] = useState<ShareStatus>("idle");
  const [message, setMessage] = useState(
    "Координаты отправятся автоматически, когда у вас есть активный маршрут.",
  );
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!hasActiveTasks) {
      return;
    }

    if (!("geolocation" in navigator)) {
      window.setTimeout(() => {
        if (isMountedRef.current) {
          setStatus("unsupported");
          setMessage("На этом устройстве нет доступа к геолокации.");
        }
      }, 0);
      return;
    }

    const updateLocation = () => {
      if (requestInFlightRef.current) {
        return;
      }

      const now = Date.now();

      if (now - lastSentAtRef.current < COURIER_LOCATION_REFRESH_INTERVAL_MS) {
        return;
      }

      requestInFlightRef.current = true;
      setStatus("updating");
      setMessage("Геолокация работает автоматически и обновляется примерно раз в 20 минут.");

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
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

            lastSentAtRef.current = Date.now();

            if (isMountedRef.current) {
              const updatedAt = payload?.location?.updatedAt ?? new Date().toISOString();
              setLastUpdatedAt(updatedAt);
              setStatus("active");
              setMessage("Координаты обновляются автоматически. GPS включается редко, чтобы беречь заряд.");
            }
          } catch (error) {
            if (isMountedRef.current) {
              setStatus("error");
              setMessage(error instanceof Error ? error.message : "Не удалось отправить геолокацию.");
            }
          } finally {
            requestInFlightRef.current = false;
          }
        },
        (error) => {
          requestInFlightRef.current = false;

          if (isMountedRef.current) {
            setStatus("error");
            setMessage(getErrorMessage(error));
          }
        },
        {
          enableHighAccuracy: false,
          maximumAge: COURIER_LOCATION_REFRESH_INTERVAL_MS,
          timeout: 20000,
        },
      );
    };

    updateLocation();
    const intervalId = window.setInterval(
      updateLocation,
      COURIER_LOCATION_REFRESH_INTERVAL_MS,
    );

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        updateLocation();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [hasActiveTasks]);

  const displayStatus = hasActiveTasks ? status : "idle";
  const displayMessage = hasActiveTasks
    ? message
    : "Активных точек сейчас нет, поэтому GPS не запрашивается.";
  const isActive = displayStatus === "active";
  const isUpdating = displayStatus === "updating";
  const isError = displayStatus === "error" || displayStatus === "unsupported";

  return (
    <section className="glass-panel rounded-[2rem] p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
            {isActive ? (
              <CheckCircle2 size={21} />
            ) : isError ? (
              <TriangleAlert size={21} />
            ) : isUpdating ? (
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
              Автоматическая передача координат
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              {displayMessage}
              {lastUpdatedAt ? ` Последнее обновление: ${formatTime(lastUpdatedAt)}.` : ""}
            </p>
            {!hasActiveTasks && (
              <p className="mt-2 flex gap-2 text-xs text-amber-700">
                <TriangleAlert size={14} className="mt-0.5 shrink-0" />
                GPS включится сам, когда появятся активные точки маршрута.
              </p>
            )}
          </div>
        </div>

        <div className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white/80 px-5 text-sm font-semibold text-[var(--accent-strong)] ring-1 ring-[var(--line)]">
          {isActive ? <RadioTower size={17} /> : <Crosshair size={17} />}
          Обновление раз в 20 минут
        </div>
      </div>
    </section>
  );
}
