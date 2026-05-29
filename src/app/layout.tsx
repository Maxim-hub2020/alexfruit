import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import "./globals.css";
import { AppNotificationsProvider } from "@/components/providers/app-notifications-provider";
import { CartProvider } from "@/components/providers/cart-provider";
import { PressFeedbackProvider } from "@/components/providers/press-feedback-provider";

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
    "АлексФрут: свежие фрукты и овощи с доставкой по Ростову-на-Дону.",
  manifest: "/manifest.webmanifest",
  applicationName: "АлексФрут",
  appleWebApp: {
    capable: true,
    title: "АлексФрут",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: true,
  },
  icons: {
    icon: "/brand/alexfrut-logo-icon.png",
    apple: "/brand/alexfrut-logo-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#2f8f4f",
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
      <body className="min-h-full text-[var(--foreground)]">
        <PressFeedbackProvider>
          <CartProvider>
            <AppNotificationsProvider>{children}</AppNotificationsProvider>
          </CartProvider>
        </PressFeedbackProvider>
      </body>
    </html>
  );
}
