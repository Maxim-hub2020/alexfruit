"use client";

import { useDeferredValue, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MapPin, Pencil, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type AddressSuggestion = {
  id: string;
  title: string;
  subtitle: string;
  formattedAddress: string;
  city: string;
  street: string;
  house: string;
  apartment: string;
  latitude: number | null;
  longitude: number | null;
  source: "dadata" | "fallback";
};

type AddressForm = {
  title: string;
  addressText: string;
  city: string;
  street: string;
  house: string;
  apartment: string;
  entrance: string;
  floor: string;
  comment: string;
  latitude: number | null;
  longitude: number | null;
  isDefault: boolean;
};

const EMPTY_FORM: AddressForm = {
  title: "Дом",
  addressText: "",
  city: "Ростов-на-Дону",
  street: "",
  house: "",
  apartment: "",
  entrance: "",
  floor: "",
  comment: "",
  latitude: null,
  longitude: null,
  isDefault: false,
};

const ADDRESS_SUGGEST_MIN_LENGTH = 3;

export function AddressBook({
  addresses,
}: {
  addresses: Array<{
    id: string;
    title: string;
    city: string;
    street: string;
    house: string;
    apartment?: string | null;
    entrance?: string | null;
    floor?: string | null;
    comment?: string | null;
    latitude?: string | null;
    longitude?: string | null;
    isDefault: boolean;
  }>;
}) {
  const router = useRouter();
  const [form, setForm] = useState<AddressForm>(EMPTY_FORM);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [error, setError] = useState("");
  const [source, setSource] = useState<"dadata" | "fallback" | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const deferredAddressText = useDeferredValue(form.addressText);
  const selectedAddressTextRef = useRef("");
  const requestIdRef = useRef(0);

  function getAddressText(address: {
    city: string;
    street: string;
    house: string;
    apartment?: string | null;
  }) {
    return `${address.city}, ${address.street}, ${address.house}${
      address.apartment ? `, кв. ${address.apartment}` : ""
    }`;
  }

  function resetForm() {
    setForm({ ...EMPTY_FORM });
    setEditingAddressId(null);
    selectedAddressTextRef.current = "";
    requestIdRef.current += 1;
    setSuggestions([]);
    setSource(null);
    setIsLoading(false);
    setError("");
  }

  function startEditAddress(address: {
    id: string;
    title: string;
    city: string;
    street: string;
    house: string;
    apartment?: string | null;
    entrance?: string | null;
    floor?: string | null;
    comment?: string | null;
    latitude?: string | null;
    longitude?: string | null;
    isDefault: boolean;
  }) {
    const addressText = getAddressText(address);

    selectedAddressTextRef.current = addressText;
    requestIdRef.current += 1;
    setSuggestions([]);
    setEditingAddressId(address.id);
    setForm({
      title: address.title,
      addressText,
      city: address.city,
      street: address.street,
      house: address.house,
      apartment: address.apartment ?? "",
      entrance: address.entrance ?? "",
      floor: address.floor ?? "",
      comment: address.comment ?? "",
      latitude: address.latitude ? Number(address.latitude) : null,
      longitude: address.longitude ? Number(address.longitude) : null,
      isDefault: address.isDefault,
    });
    setError("");
  }

  useEffect(() => {
    const query = deferredAddressText.trim();

    if (query.length < ADDRESS_SUGGEST_MIN_LENGTH || query === selectedAddressTextRef.current) {
      requestIdRef.current += 1;
      setSuggestions([]);
      setIsLoading(false);
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setIsLoading(true);

      try {
        const response = await fetch(
          `/api/geo/suggest?text=${encodeURIComponent(query)}`,
          { signal: controller.signal },
        );
        const result = await response.json();

        if (requestId !== requestIdRef.current || query === selectedAddressTextRef.current) {
          return;
        }

        if (!response.ok) {
          setError(result.error ?? "Не удалось получить подсказки адреса");
          setSuggestions([]);
          return;
        }

        setSuggestions(result.suggestions ?? []);
        setSource(result.source ?? null);
      } catch (fetchError) {
        if (
          requestId === requestIdRef.current &&
          !(fetchError instanceof DOMException && fetchError.name === "AbortError")
        ) {
          setSuggestions([]);
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setIsLoading(false);
        }
      }
    }, 280);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [deferredAddressText]);

  function selectSuggestion(suggestion: AddressSuggestion) {
    selectedAddressTextRef.current = suggestion.formattedAddress.trim();
    requestIdRef.current += 1;
    setForm((current) => ({
      ...current,
      addressText: suggestion.formattedAddress,
      city: suggestion.city || "Ростов-на-Дону",
      street: suggestion.street,
      house: suggestion.house,
      apartment: suggestion.apartment || current.apartment,
      latitude: suggestion.latitude,
      longitude: suggestion.longitude,
    }));
    setSuggestions([]);
    setIsLoading(false);
    setError("");
  }

  async function saveAddress() {
    setError("");

    if (!form.street || !form.house) {
      setError("Выберите адрес из подсказок DaData с улицей и номером дома.");
      return;
    }

    const response = await fetch(
      editingAddressId ? `/api/addresses/${editingAddressId}` : "/api/addresses",
      {
        method: editingAddressId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          city: form.city,
          street: form.street,
          house: form.house,
          apartment: form.apartment,
          entrance: form.entrance,
          floor: form.floor,
          comment: form.comment,
          latitude: form.latitude ?? undefined,
          longitude: form.longitude ?? undefined,
          isDefault: form.isDefault,
        }),
      },
    );
    const result = await response.json();

    if (!response.ok) {
      setError(result.error ?? "Не удалось сохранить адрес");
      return;
    }

    resetForm();
    router.refresh();
  }

  async function deleteAddress(addressId: string) {
    if (!window.confirm("Удалить адрес из профиля? В старых заказах он останется для истории.")) {
      return;
    }

    setError("");
    const response = await fetch(`/api/addresses/${addressId}`, {
      method: "DELETE",
    });
    const result = await response.json();

    if (!response.ok) {
      setError(result.error ?? "Не удалось удалить адрес");
      return;
    }

    if (editingAddressId === addressId) {
      resetForm();
    }

    router.refresh();
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1.05fr]">
      <div className="space-y-3">
        {addresses.map((address) => (
          <div
            key={address.id}
            className="rounded-[1.5rem] bg-white/90 p-4 ring-1 ring-[var(--line)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{address.title}</p>
                <p className="text-sm text-[var(--muted)]">
                  {address.city}, {address.street}, {address.house}
                  {address.apartment ? `, кв. ${address.apartment}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                {address.isDefault ? (
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-900">
                    Основной
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => startEditAddress(address)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface-muted)] text-[var(--ink)] transition hover:bg-white"
                  aria-label="Изменить адрес"
                  title="Изменить адрес"
                >
                  <Pencil size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => deleteAddress(address.id)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-rose-50 text-rose-700 transition hover:bg-rose-100"
                  aria-label="Удалить адрес"
                  title="Удалить адрес"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-[2rem] bg-white/85 p-5 ring-1 ring-[var(--line)]">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-xl font-semibold">
            {editingAddressId ? "Редактирование адреса" : "Новый адрес"}
          </h3>
          {editingAddressId ? (
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-muted)] px-3 py-1 text-xs font-semibold text-[var(--muted)]"
            >
              <X size={13} />
              Отменить
            </button>
          ) : null}
        </div>

        <div className="mt-4 grid gap-3">
          <label className="space-y-2 text-sm font-medium">
            <span>Название адреса</span>
            <input
              value={form.title}
              onChange={(event) =>
                setForm((current) => ({ ...current, title: event.target.value }))
              }
              placeholder="Дом, работа, офис"
              className="h-11 w-full rounded-2xl bg-[var(--surface-muted)] px-4 outline-none"
            />
          </label>

          <div className="relative">
            <label className="space-y-2 text-sm font-medium">
              <span className="flex items-center gap-2">
                <Search size={15} />
                Начните вводить адрес
              </span>
              <input
                value={form.addressText}
                onChange={(event) =>
                  {
                    const nextValue = event.target.value;
                    if (nextValue.trim() !== selectedAddressTextRef.current) {
                      selectedAddressTextRef.current = "";
                    }
                    setForm((current) => ({
                      ...current,
                      addressText: nextValue,
                      street: "",
                      house: "",
                      city: "Ростов-на-Дону",
                      latitude: null,
                      longitude: null,
                    }));

                    if (nextValue.trim().length < ADDRESS_SUGGEST_MIN_LENGTH) {
                      requestIdRef.current += 1;
                      setSuggestions([]);
                      setSource(null);
                      setIsLoading(false);
                    }
                  }
                }
                placeholder="Например: Пушкинская 104"
                autoComplete="street-address"
                className="h-12 w-full rounded-2xl bg-[var(--surface-muted)] px-4 outline-none ring-1 ring-transparent focus:ring-[var(--accent-soft)]"
              />
            </label>

            {(suggestions.length > 0 || isLoading) && (
              <div className="absolute inset-x-0 top-full z-20 mt-2 overflow-hidden rounded-[1.5rem] bg-white shadow-2xl ring-1 ring-[var(--line)]">
                {isLoading ? (
                  <div className="flex items-center gap-2 p-4 text-sm text-[var(--muted)]">
                    <Loader2 size={16} className="animate-spin" />
                    Сейчас вас найдём
                  </div>
                ) : (
                  suggestions.map((suggestion) => (
                    <button
                      key={suggestion.id}
                      type="button"
                      onClick={() => selectSuggestion(suggestion)}
                      className="flex w-full items-start gap-3 border-b border-[var(--line)] px-4 py-3 text-left last:border-b-0 hover:bg-[var(--surface-muted)]"
                    >
                      <MapPin size={17} className="mt-0.5 text-[var(--accent-strong)]" />
                      <span>
                        <span className="block font-semibold">{suggestion.title}</span>
                        <span className="block text-sm text-[var(--muted)]">
                          {suggestion.subtitle || suggestion.formattedAddress}
                        </span>
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {source === "fallback" && (
            <p className="rounded-[1.25rem] bg-amber-50 p-3 text-xs text-amber-900">
              Проверьте адрес перед сохранением: подсказки могут быть временно
              ограничены.
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["apartment", "Квартира"],
              ["entrance", "Подъезд"],
              ["floor", "Этаж"],
            ].map(([field, label]) => (
              <input
                key={field}
                value={form[field as keyof AddressForm] as string}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    [field]: event.target.value,
                  }))
                }
                placeholder={label}
                className="h-11 rounded-2xl bg-[var(--surface-muted)] px-4 outline-none"
              />
            ))}
          </div>

          <textarea
            value={form.comment}
            onChange={(event) =>
              setForm((current) => ({ ...current, comment: event.target.value }))
            }
            placeholder="Комментарий для курьера"
            rows={3}
            className="rounded-2xl bg-[var(--surface-muted)] px-4 py-3 outline-none"
          />
          <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(event) =>
                setForm((current) => ({ ...current, isDefault: event.target.checked }))
              }
            />
            Сделать основным адресом
          </label>
          {error && <p className="text-sm text-rose-700">{error}</p>}
          <Button onClick={() => saveAddress()}>
            {editingAddressId ? "Сохранить изменения" : "Сохранить адрес"}
          </Button>
        </div>
      </div>
    </div>
  );
}
