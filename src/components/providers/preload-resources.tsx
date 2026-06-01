"use client";

import ReactDOM from "react-dom";

const mobileMedia = "(max-width: 767px)";

export function PreloadResources() {
  ReactDOM.preload("/brand/alexfrut-logo-icon.png", {
    as: "image",
    fetchPriority: "high",
    media: mobileMedia,
  });

  return null;
}
