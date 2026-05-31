import Link from "next/link";
import { Clock, MapPin, Navigation, RadioTower, TriangleAlert } from "lucide-react";
import { StatusPill } from "@/components/ui/status-pill";
import { buildYandexMapWidgetUrl, type RouteQueryPoint } from "@/lib/yandex-routes";
import { formatDateTimeLabel, getAddressLabel } from "@/lib/utils";

type AdminCourierLocation = {
  id: string;
  name: string;
  phone?: string | null;
  location: {
    latitude: number;
    longitude: number;
    accuracy: number | null;
    updatedAt: string;
  } | null;
  currentOrder: {
    orderNumber: string;
    status: string;
    address: {
      city: string;
      street: string;
      house: string;
      apartment?: string | null;
    };
    deliveryTimeSlot: {
      title: string;
    };
  } | null;
};

function getCourierMapUrl(couriers: AdminCourierLocation[]) {
  const points: RouteQueryPoint[] = couriers
    .filter((courier) => courier.location)
    .map((courier) => ({
      address: courier.name,
      latitude: courier.location!.latitude,
      longitude: courier.location!.longitude,
    }));

  return buildYandexMapWidgetUrl(points);
}

function getYandexPointUrl(location: NonNullable<AdminCourierLocation["location"]>) {
  const url = new URL("https://yandex.ru/maps/");
  url.searchParams.set("ll", `${location.longitude},${location.latitude}`);
  url.searchParams.set("z", "16");
  url.searchParams.set("pt", `${location.longitude},${location.latitude},pm2gnm`);
  return url.toString();
}

export function AdminCourierLocations({
  couriers,
}: {
  couriers: AdminCourierLocation[];
}) {
  const couriersWithLocation = couriers.filter((courier) => courier.location);
  const mapUrl = getCourierMapUrl(couriers);

  return (
    <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="glass-panel overflow-hidden rounded-[2.2rem]">
        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted)]">
              Курьеры онлайн
            </p>
            <h2 className="mt-1 text-2xl font-semibold">
              {couriersWithLocation.length}/{couriers.length} на карте
            </h2>
          </div>
          <div className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-[var(--accent-strong)] ring-1 ring-[var(--line)]">
            Обновляется после включения GPS
          </div>
        </div>

        <iframe
          src={mapUrl}
          title="Курьеры на карте"
          className="h-[24rem] w-full border-0"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>

      <aside className="glass-panel rounded-[2.2rem] p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
            <RadioTower size={20} />
          </div>
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-[var(--muted)]">
              Живые координаты
            </p>
            <h2 className="text-2xl font-semibold">Активные курьеры</h2>
          </div>
        </div>

        {couriers.length === 0 ? (
          <div className="mt-5 rounded-[1.5rem] bg-white/80 p-5 text-sm text-[var(--muted)]">
            Активных курьеров пока нет.
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {couriers.map((courier) => (
              <article key={courier.id} className="rounded-[1.5rem] bg-white/86 p-4 ring-1 ring-[var(--line)]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{courier.name}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {courier.phone ?? "телефон не указан"}
                    </p>
                  </div>
                  {courier.location ? (
                    <Link
                      href={getYandexPointUrl(courier.location)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-900"
                    >
                      <Navigation size={13} />
                      Карта
                    </Link>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
                      <TriangleAlert size={13} />
                      GPS нет
                    </span>
                  )}
                </div>

                {courier.location ? (
                  <p className="mt-3 flex gap-2 text-xs text-[var(--muted)]">
                    <Clock size={14} className="mt-0.5 shrink-0" />
                    {formatDateTimeLabel(courier.location.updatedAt)}
                    {courier.location.accuracy
                      ? ` · точность ${Math.round(courier.location.accuracy)} м`
                      : ""}
                  </p>
                ) : (
                  <p className="mt-3 text-xs text-[var(--muted)]">
                    Курьер ещё не включил передачу геолокации.
                  </p>
                )}

                {courier.currentOrder ? (
                  <div className="mt-3 rounded-[1.2rem] bg-[var(--surface-muted)] p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">
                        {courier.currentOrder.orderNumber}
                      </span>
                      <StatusPill status={courier.currentOrder.status} />
                    </div>
                    <p className="mt-2 flex gap-2 text-[var(--muted)]">
                      <MapPin size={14} className="mt-0.5 shrink-0" />
                      <span>
                        {getAddressLabel(courier.currentOrder.address)} ·{" "}
                        {courier.currentOrder.deliveryTimeSlot.title}
                      </span>
                    </p>
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-[var(--muted)]">
                    Активный заказ сейчас не выбран.
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </aside>
    </section>
  );
}
