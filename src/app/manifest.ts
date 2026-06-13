import type { MetadataRoute } from "next";

type ManifestWithLaunchHandler = MetadataRoute.Manifest & {
  launch_handler?: {
    client_mode: "focus-existing";
  };
};

export default function manifest(): MetadataRoute.Manifest {
  const appManifest: ManifestWithLaunchHandler = {
    id: "/",
    name: "АлексФрут",
    short_name: "АлексФрут",
    description: "Доставка фруктов и овощей по Ростову-на-Дону.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f3f8ef",
    theme_color: "#2f8f4f",
    orientation: "portrait",
    icons: [
      {
        src: "/brand/alexfrut-logo-icon.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/alexfrut-logo-square.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
    launch_handler: {
      client_mode: "focus-existing",
    },
  };

  return appManifest;
}
