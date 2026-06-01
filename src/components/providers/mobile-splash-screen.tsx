"use client";

import { useEffect, useState } from "react";

const SPLASH_DURATION_MS = 2800;

export function MobileSplashScreen() {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timerId = globalThis.setTimeout(() => {
      setIsVisible(false);
    }, SPLASH_DURATION_MS);

    return () => {
      globalThis.clearTimeout(timerId);
    };
  }, []);

  if (!isVisible) {
    return null;
  }

  return (
    <div className="mobile-splash-screen" aria-hidden="true">
      <video
        className="mobile-splash-screen__video"
        src="/splash/alexfrut-intro.mp4"
        poster="/brand/alexfrut-logo-square.png"
        autoPlay
        muted
        playsInline
        preload="auto"
        onEnded={() => setIsVisible(false)}
      />
    </div>
  );
}
