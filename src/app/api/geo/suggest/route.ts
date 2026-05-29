import { NextResponse } from "next/server";
import { Role } from "@/generated/prisma";
import { jsonError } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

type DadataAddressData = {
  fias_id?: string | null;
  city?: string | null;
  settlement_with_type?: string | null;
  street_with_type?: string | null;
  street?: string | null;
  house_type?: string | null;
  house?: string | null;
  block_type?: string | null;
  block?: string | null;
  flat?: string | null;
  geo_lat?: string | null;
  geo_lon?: string | null;
};

type DadataSuggestion = {
  value?: string;
  unrestricted_value?: string;
  data?: DadataAddressData;
};

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

const ROSTOV_CITY = "Ростов-на-Дону";
const ADDRESS_SUGGEST_MIN_LENGTH = 3;

const FALLBACK_SUGGESTIONS: AddressSuggestion[] = [
  {
    id: "fallback-pushkinskaya-104",
    title: "Пушкинская улица, 104",
    subtitle: ROSTOV_CITY,
    formattedAddress: "Ростов-на-Дону, Пушкинская улица, 104",
    city: ROSTOV_CITY,
    street: "Пушкинская улица",
    house: "104",
    apartment: "",
    latitude: 47.2288,
    longitude: 39.7291,
    source: "fallback",
  },
  {
    id: "fallback-bolshaya-sadovaya-72",
    title: "Большая Садовая улица, 72",
    subtitle: ROSTOV_CITY,
    formattedAddress: "Ростов-на-Дону, Большая Садовая улица, 72",
    city: ROSTOV_CITY,
    street: "Большая Садовая улица",
    house: "72",
    apartment: "",
    latitude: 47.2214,
    longitude: 39.7115,
    source: "fallback",
  },
  {
    id: "fallback-rylskogo-1",
    title: "улица Рыльского, 1",
    subtitle: ROSTOV_CITY,
    formattedAddress: "Ростов-на-Дону, улица Рыльского, 1",
    city: ROSTOV_CITY,
    street: "улица Рыльского",
    house: "1",
    apartment: "",
    latitude: 47.2452,
    longitude: 39.7162,
    source: "fallback",
  },
  {
    id: "fallback-budennovskiy-49",
    title: "Будённовский проспект, 49",
    subtitle: ROSTOV_CITY,
    formattedAddress: "Ростов-на-Дону, Будённовский проспект, 49",
    city: ROSTOV_CITY,
    street: "Будённовский проспект",
    house: "49",
    apartment: "",
    latitude: 47.2228,
    longitude: 39.7029,
    source: "fallback",
  },
];

function normalize(value: string) {
  return value.toLowerCase().replace(/ё/g, "е");
}

function toCoordinate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const coordinate = Number(value);
  return Number.isFinite(coordinate) ? coordinate : null;
}

function formatTypedPart(type: string | null | undefined, value: string | null | undefined) {
  return [type, value].filter(Boolean).join(" ").trim();
}

function getHouse(data: DadataAddressData | undefined) {
  if (!data) {
    return "";
  }

  return [
    formatTypedPart(data.house_type, data.house),
    formatTypedPart(data.block_type, data.block),
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function getFallbackSuggestions(text: string) {
  const query = normalize(text);
  const tokens = query.split(/\s+/).filter(Boolean);

  return FALLBACK_SUGGESTIONS.filter((suggestion) => {
    const address = normalize(suggestion.formattedAddress);
    return address.includes(query) || tokens.every((token) => address.includes(token));
  }).slice(0, 6);
}

function mapDadataSuggestion(item: DadataSuggestion, index: number): AddressSuggestion {
  const data = item.data;
  const city = data?.city || data?.settlement_with_type || ROSTOV_CITY;
  const street = data?.street_with_type || data?.street || "";
  const house = getHouse(data);
  const formattedAddress =
    item.unrestricted_value || item.value || [city, street, house].filter(Boolean).join(", ");

  return {
    id: data?.fias_id || `${formattedAddress}-${index}`,
    title: item.value || formattedAddress,
    subtitle: [city, street && !item.value?.includes(street) ? street : ""]
      .filter(Boolean)
      .join(", "),
    formattedAddress,
    city,
    street,
    house,
    apartment: data?.flat || "",
    latitude: toCoordinate(data?.geo_lat),
    longitude: toCoordinate(data?.geo_lon),
    source: "dadata",
  };
}

async function getDadataSuggestions(text: string) {
  const apiKey = process.env.DADATA_API_KEY;

  if (!apiKey) {
    return null;
  }

  const response = await fetch(
    "https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address",
    {
      method: "POST",
      cache: "no-store",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: text,
        count: 7,
        locations: [{ city: ROSTOV_CITY }],
        locations_boost: [{ city: ROSTOV_CITY }],
        to_bound: { value: "house" },
      }),
    },
  );

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  const suggestions = Array.isArray(data?.suggestions)
    ? (data.suggestions as DadataSuggestion[])
    : [];

  return suggestions
    .map(mapDadataSuggestion)
    .filter((suggestion) => suggestion.street && suggestion.house);
}

export async function GET(request: Request) {
  try {
    await requireApiUser([Role.CUSTOMER]);

    const { searchParams } = new URL(request.url);
    const text = searchParams.get("text")?.trim() ?? "";

    if (text.length < ADDRESS_SUGGEST_MIN_LENGTH) {
      return NextResponse.json({ suggestions: [] });
    }

    const dadataSuggestions = await getDadataSuggestions(text);
    const suggestions =
      dadataSuggestions && dadataSuggestions.length > 0
        ? dadataSuggestions
        : getFallbackSuggestions(text);

    return NextResponse.json({
      suggestions,
      source: dadataSuggestions ? "dadata" : "fallback",
    });
  } catch (error) {
    return jsonError(error);
  }
}
