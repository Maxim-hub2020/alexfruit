"use client";

import { useEffect, useState } from "react";
import { Clock, LocateFixed, MapPin, RefreshCcw } from "lucide-react";
import { COURIER_LOCATION_REFRESH_INTERVAL_MS } from "@/lib/location-refresh";

type CourierLocationResponse = {
  available: boolean;
  reason?: string;
  courier?: {
    name: string;
    phone?: string | null;
  };
  location?: {
    latitude: number;
    longitude: number;
    accuracy: number | null;
    updatedAt: string;
  };
  eta?: {
    distanceKm: number;
    minutes: number;
  } | null;
};

async function fetchCourierLocation(orderId: string) {
  const response = await fetch(`/api/orders/${orderId}/courier-location`, {
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error ?? "Не удалось получить геолокацию курьера.");
  }

  return payload as CourierLocationResponse;
}

function getCourierMapUrl(location: NonNullable<CourierLocationResponse["location"]>) {
  const url = new URL("https://yandex.ru/map-widget/v1/");
  url.searchParams.set("ll", `${location.longitude},${location.latitude}`);
  url.searchParams.set("z", "16");
  url.searchParams.set("pt", `${location.longitude},${location.latitude},pm2gnm`);
  return url.toString();
}

function formatUpdatedAt(value: string) {
  return new Date(value).toLocaleString("ru-RU", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatEta(minutes: number) {
  if (minutes < 60) {
    return `примерно через ${minutes} мин.`;
  }

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  return rest === 0
    ? `примерно через ${hours} ч.`
    : `примерно через ${hours} ч. ${rest} мин.`;
}

export function CustomerCourierLocation({ orderId }: { orderId: string }) {
  const [data, setData] = useState<CourierLocationResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    function loadLocation(showSpinner: boolean) {
      if (showSpinner) {
        setIsLoading(true);
      }

      fetchCourierLocation(orderId)
        .then((payload) => {
          if (isMounted) {
            setData(payload);
            setError("");
          }
        })
        .catch((fetchError: Error) => {
          if (isMounted) {
            setError(fetchError.message);
          }
        })
        .finally(() => {
          if (isMounted) {
            setIsLoading(false);
          }
        });
    }

    loadLocation(true);
    const intervalId = window.setInterval(
      () => loadLocation(false),
      COURIER_LOCATION_REFRESH_INTERVAL_MS,
    );

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [orderId]);

  function refresh() {
    setIsLoading(true);
    fetchCourierLocation(orderId)
      .then((payload) => {
        setData(payload);
        setError("");
      })
      .catch((fetchError: Error) => {
        setError(fetchError.message);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }

  const location = data?.location;

  return (
    <div className="mt-4 overflow-hidden rounded-[1.6rem] bg-white/86 ring-1 ring-[var(--line)]">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
            <LocateFixed size={18} />
          </div>
          <div>
            <p className="font-semibold">Курьер на карте</p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {data?.eta
                ? `Курьер будет ${formatEta(data.eta.minutes)}`
                : data?.courier?.name
                  ? `Курьер: ${data.courier.name}`
                  : "Карта появится после назначения курьера."}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={isLoading}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl bg-[var(--surface-muted)] px-4 text-sm font-semibold text-[var(--foreground)] disabled:opacity-60"
        >
          <RefreshCcw size={15} className={isLoading ? "animate-spin" : ""} />
          Обновить
        </button>
      </div>

      {error ? (
        <p className="px-4 pb-4 text-sm text-red-700">{error}</p>
      ) : location ? (
        <>
          <iframe
            src={getCourierMapUrl(location)}
            title="Положение курьера"
            className="h-64 w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
          <div className="flex flex-wrap gap-3 px-4 py-3 text-xs text-[var(--muted)]">
            {data.eta ? (
              <span className="inline-flex items-center gap-1 font-semibold text-[var(--accent-strong)]">
                <LocateFixed size={13} />
                До вас около {data.eta.distanceKm.toFixed(1)} км,{" "}
                {formatEta(data.eta.minutes)}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1">
                <LocateFixed size={13} />
                Время прибытия появится после уточнения адреса и координат.
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Clock size={13} />
              Обновлено: {formatUpdatedAt(location.updatedAt)}
            </span>
            {location.accuracy ? (
              <span className="inline-flex items-center gap-1">
                <MapPin size={13} />
                Точность около {Math.round(location.accuracy)} м
              </span>
            ) : null}
          </div>
        </>
      ) : (
        <p className="px-4 pb-4 text-sm text-[var(--muted)]">
          {isLoading
            ? "Проверяем геолокацию курьера..."
            : data?.reason ?? "Курьер ещё не передаёт координаты."}
        </p>
      )}
    </div>
  );
}
