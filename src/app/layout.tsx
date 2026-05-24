import type { Metadata } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/components/providers/cart-provider";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "cyrillic"],
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin", "cyrillic"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "АлексФрут",
  description:
    "АлексФрут: доставка фруктов и овощей по Ростову-на-Дону, каталог, заказы, админ-панель и кабинет курьера.",
  icons: {
    icon: "/brand/alexfrut-logo-icon.png",
    apple: "/brand/alexfrut-logo-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ru"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={`${manrope.variable} ${cormorant.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[var(--background)] text-[var(--foreground)]">
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
