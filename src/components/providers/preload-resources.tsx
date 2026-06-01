"use client";

import ReactDOM from "react-dom";

const mobileMedia = "(max-width: 767px)";

export function PreloadResources() {
  ReactDOM.preload("/splash/alexfrut-intro.mp4", {
    as: "video",
    fetchPriority: "high",
    media: mobileMedia,
    type: "video/mp4",
  });

  ReactDOM.preload("/brand/alexfrut-logo-square.png", {
    as: "image",
    fetchPriority: "high",
    media: mobileMedia,
  });

  return null;
}
