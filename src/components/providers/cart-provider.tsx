"use client";

import {
  createContext,
  startTransition,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";

export type CartLine = {
  productId: string;
  name: string;
  price: number;
  unit: string;
  imageUrl?: string | null;
  quantity: number;
};

type CartContextValue = {
  items: CartLine[];
  count: number;
  subtotal: number;
  hydrated: boolean;
  addItem: (item: Omit<CartLine, "quantity">) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clear: () => void;
  replaceAll: (items: CartLine[]) => void;
};

const CART_STORAGE_KEY = "alexfrut-cart-v1";
const STORAGE_EVENT_NAME = "alexfrut-cart-updated";
const EMPTY_CART: CartLine[] = [];

const CartContext = createContext<CartContextValue | null>(null);

let lastSerializedCart = "";
let lastCartSnapshot: CartLine[] = EMPTY_CART;

function readCartSnapshot(): CartLine[] {
  if (typeof window === "undefined") {
    return EMPTY_CART;
  }

  const saved = globalThis.localStorage.getItem(CART_STORAGE_KEY);

  if (!saved) {
    lastSerializedCart = "";
    lastCartSnapshot = EMPTY_CART;
    return lastCartSnapshot;
  }

  try {
    if (saved === lastSerializedCart) {
      return lastCartSnapshot;
    }

    lastSerializedCart = saved;
    lastCartSnapshot = JSON.parse(saved);
    return lastCartSnapshot;
  } catch {
    globalThis.localStorage.removeItem(CART_STORAGE_KEY);
    lastSerializedCart = "";
    lastCartSnapshot = EMPTY_CART;
    return lastCartSnapshot;
  }
}

function writeCartSnapshot(items: CartLine[]) {
  if (typeof window === "undefined") {
    return;
  }

  const serialized = JSON.stringify(items);
  lastSerializedCart = serialized;
  lastCartSnapshot = items;
  globalThis.localStorage.setItem(CART_STORAGE_KEY, serialized);
  globalThis.dispatchEvent(new Event(STORAGE_EVENT_NAME));
}

function subscribeToCartChanges(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const listener = () => onStoreChange();
  globalThis.addEventListener(STORAGE_EVENT_NAME, listener);
  globalThis.addEventListener("storage", listener);

  return () => {
    globalThis.removeEventListener(STORAGE_EVENT_NAME, listener);
    globalThis.removeEventListener("storage", listener);
  };
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const items = useSyncExternalStore(
    subscribeToCartChanges,
    readCartSnapshot,
    () => EMPTY_CART,
  );

  const value = useMemo<CartContextValue>(() => {
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    return {
      items,
      count: items.reduce((sum, item) => sum + item.quantity, 0),
      subtotal,
      hydrated: typeof window !== "undefined",
      addItem(item) {
        startTransition(() => {
          const current = readCartSnapshot();
          const existing = current.find((entry) => entry.productId === item.productId);

          if (existing) {
            writeCartSnapshot(
              current.map((entry) =>
                entry.productId === item.productId
                  ? { ...entry, quantity: entry.quantity + 1 }
                  : entry,
              ),
            );
            return;
          }

          writeCartSnapshot([...current, { ...item, quantity: 1 }]);
        });
      },
      updateQuantity(productId, quantity) {
        startTransition(() => {
          const current = readCartSnapshot();
          writeCartSnapshot(
            current
              .map((item) =>
                item.productId === productId
                  ? { ...item, quantity: Math.max(0, quantity) }
                  : item,
              )
              .filter((item) => item.quantity > 0),
          );
        });
      },
      removeItem(productId) {
        startTransition(() => {
          const current = readCartSnapshot();
          writeCartSnapshot(current.filter((item) => item.productId !== productId));
        });
      },
      clear() {
        startTransition(() => {
          writeCartSnapshot([]);
        });
      },
      replaceAll(nextItems) {
        startTransition(() => {
          writeCartSnapshot(nextItems);
        });
      },
    };
  }, [items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error("useCart must be used inside CartProvider");
  }

  return context;
}
