import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import "./globals.css";
import { AppNotificationsProvider } from "@/components/providers/app-notifications-provider";
import { CartProvider } from "@/components/providers/cart-provider";
import { MobileSplashScreen } from "@/components/providers/mobile-splash-screen";
import { PreloadResources } from "@/components/providers/preload-resources";
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
    icon: [
      { url: "/brand/alexfrut-logo-icon.png", sizes: "192x192", type: "image/png" },
      { url: "/brand/alexfrut-logo-square.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#2f8f4f",
};

const serviceWorkerBootScript = `(() => {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  const register = () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => registration.update().catch(() => {}))
      .catch(() => {});
  };

  if (document.readyState === "complete") {
    register();
  } else {
    window.addEventListener("load", register, { once: true });
  }
})();`;

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
        <PreloadResources />
        <MobileSplashScreen />
        <script dangerouslySetInnerHTML={{ __html: serviceWorkerBootScript }} />
        <PressFeedbackProvider>
          <CartProvider>
            <AppNotificationsProvider>{children}</AppNotificationsProvider>
          </CartProvider>
        </PressFeedbackProvider>
      </body>
    </html>
  );
}
