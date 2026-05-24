import { NextResponse } from "next/server";
import { Role } from "@/generated/prisma";
import { jsonError } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

type YandexComponent = {
  name?: string;
  kind?: string[] | string;
};

type YandexSuggestItem = {
  title?: { text?: string };
  subtitle?: { text?: string };
  address?: {
    formatted_address?: string;
    component?: YandexComponent[];
  };
  uri?: string;
};

type AddressSuggestion = {
  id: string;
  title: string;
  subtitle: string;
  formattedAddress: string;
  city: string;
  street: string;
  house: string;
  latitude: number | null;
  longitude: number | null;
  uri?: string;
  source: "yandex" | "demo";
};

const ROSTOV_CENTER = {
  latitude: 47.2221,
  longitude: 39.7203,
};

const DEMO_SUGGESTIONS: AddressSuggestion[] = [
  {
    id: "demo-pushkinskaya-104",
    title: "Пушкинская улица, 104",
    subtitle: "Ростов-на-Дону",
    formattedAddress: "Ростов-на-Дону, Пушкинская улица, 104",
    city: "Ростов-на-Дону",
    street: "Пушкинская улица",
    house: "104",
    latitude: 47.2288,
    longitude: 39.7291,
    source: "demo",
  },
  {
    id: "demo-bolshaya-sadovaya-72",
    title: "Большая Садовая улица, 72",
    subtitle: "Ростов-на-Дону",
    formattedAddress: "Ростов-на-Дону, Большая Садовая улица, 72",
    city: "Ростов-на-Дону",
    street: "Большая Садовая улица",
    house: "72",
    latitude: 47.2214,
    longitude: 39.7115,
    source: "demo",
  },
  {
    id: "demo-rylskogo-1",
    title: "улица Рыльского, 1",
    subtitle: "Ростов-на-Дону",
    formattedAddress: "Ростов-на-Дону, улица Рыльского, 1",
    city: "Ростов-на-Дону",
    street: "улица Рыльского",
    house: "1",
    latitude: 47.2452,
    longitude: 39.7162,
    source: "demo",
  },
  {
    id: "demo-budennovskiy-49",
    title: "Будённовский проспект, 49",
    subtitle: "Ростов-на-Дону",
    formattedAddress: "Ростов-на-Дону, Будённовский проспект, 49",
    city: "Ростов-на-Дону",
    street: "Будённовский проспект",
    house: "49",
    latitude: 47.2228,
    longitude: 39.7029,
    source: "demo",
  },
];

function normalize(value: string) {
  return value.toLowerCase().replace(/ё/g, "е");
}

function getFallbackSuggestions(text: string) {
  const query = normalize(text);

  return DEMO_SUGGESTIONS.filter((suggestion) =>
    normalize(suggestion.formattedAddress).includes(query),
  ).slice(0, 6);
}

function componentHasKind(component: YandexComponent, kind: string) {
  const kinds = Array.isArray(component.kind) ? component.kind : [component.kind];
  return kinds.some((value) => value?.toLowerCase() === kind);
}

function getComponent(components: YandexComponent[] | undefined, kind: string) {
  return components?.find((component) => componentHasKind(component, kind))?.name ?? "";
}

function parseAddressComponents(components: YandexComponent[] | undefined) {
  return {
    city:
      getComponent(components, "locality") ||
      getComponent(components, "province") ||
      "Ростов-на-Дону",
    street: getComponent(components, "street"),
    house: getComponent(components, "house"),
  };
}

async function getCoordinates(params: {
  apiKey: string;
  address: string;
  uri?: string;
}) {
  const url = new URL("https://geocode-maps.yandex.ru/v1/");
  url.searchParams.set("apikey", params.apiKey);
  url.searchParams.set("lang", "ru_RU");
  url.searchParams.set("format", "json");
  url.searchParams.set("results", "1");
  url.searchParams.set("ll", `${ROSTOV_CENTER.longitude},${ROSTOV_CENTER.latitude}`);
  url.searchParams.set("spn", "0.45,0.35");
  url.searchParams.set("rspn", "1");

  if (params.uri) {
    url.searchParams.set("uri", params.uri);
  } else {
    url.searchParams.set("geocode", params.address);
  }

  try {
    const response = await fetch(url, { next: { revalidate: 60 * 60 * 24 } });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const geoObject =
      data?.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject;
    const position = geoObject?.Point?.pos;

    if (typeof position !== "string") {
      return null;
    }

    const [longitude, latitude] = position.split(" ").map(Number);
    const components =
      geoObject?.metaDataProperty?.GeocoderMetaData?.Address?.Components;

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return null;
    }

    return {
      latitude,
      longitude,
      components: Array.isArray(components) ? components : undefined,
    };
  } catch {
    return null;
  }
}

async function getYandexSuggestions(text: string, sessiontoken: string | null) {
  const apiKey = process.env.YANDEX_MAPS_API_KEY;

  if (!apiKey) {
    return null;
  }

  const url = new URL("https://suggest-maps.yandex.ru/v1/suggest");
  url.searchParams.set("apikey", apiKey);
  url.searchParams.set("text", text);
  url.searchParams.set("lang", "ru");
  url.searchParams.set("results", "6");
  url.searchParams.set("highlight", "0");
  url.searchParams.set("ll", `${ROSTOV_CENTER.longitude},${ROSTOV_CENTER.latitude}`);
  url.searchParams.set("spn", "0.45,0.35");
  url.searchParams.set("strict_bounds", "1");
  url.searchParams.set("countries", "ru");
  url.searchParams.set("types", "house,street");
  url.searchParams.set("print_address", "1");
  url.searchParams.set("attrs", "uri");

  if (sessiontoken) {
    url.searchParams.set("sessiontoken", sessiontoken);
  }

  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  const results = Array.isArray(data?.results)
    ? (data.results as YandexSuggestItem[])
    : [];

  return Promise.all(
    results.map(async (item, index): Promise<AddressSuggestion> => {
      const components = parseAddressComponents(item.address?.component);
      const formattedAddress =
        item.address?.formatted_address ||
        item.title?.text ||
        `${components.city}, ${components.street}, ${components.house}`;
      const coordinates = await getCoordinates({
        apiKey,
        address: formattedAddress,
        uri: item.uri,
      });
      const geocodedComponents = parseAddressComponents(coordinates?.components);

      return {
        id: item.uri ?? `yandex-${index}`,
        title: item.title?.text ?? formattedAddress,
        subtitle: item.subtitle?.text ?? components.city,
        formattedAddress,
        city: geocodedComponents.city || components.city,
        street: geocodedComponents.street || components.street,
        house: geocodedComponents.house || components.house,
        latitude: coordinates?.latitude ?? null,
        longitude: coordinates?.longitude ?? null,
        uri: item.uri,
        source: "yandex",
      };
    }),
  );
}

export async function GET(request: Request) {
  try {
    await requireApiUser([Role.CUSTOMER]);

    const { searchParams } = new URL(request.url);
    const text = searchParams.get("text")?.trim() ?? "";
    const sessiontoken = searchParams.get("sessiontoken");

    if (text.length < 2) {
      return NextResponse.json({ suggestions: [] });
    }

    const yandexSuggestions = await getYandexSuggestions(text, sessiontoken);
    const suggestions =
      yandexSuggestions && yandexSuggestions.length > 0
        ? yandexSuggestions
        : getFallbackSuggestions(text);

    return NextResponse.json({
      suggestions,
      source: yandexSuggestions ? "yandex" : "demo",
    });
  } catch (error) {
    return jsonError(error);
  }
}
