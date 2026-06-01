/* eslint-disable @next/next/no-img-element -- Launch splash needs the preloaded raw icon before the app hydrates. */

const splashBootScript = `(() => {
  const splash = document.getElementById("mobile-splash-screen");

  if (!splash) {
    return;
  }

  const isMobile = window.matchMedia("(max-width: 767px)").matches;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!isMobile || reduceMotion) {
    splash.style.display = "none";
    return;
  }

  const minVisibleMs = 3000;
  const startedAt = Date.now();
  let appReady = document.readyState === "complete";
  let hidden = false;

  const hide = () => {
    if (hidden) {
      return;
    }

    hidden = true;
    window.requestAnimationFrame(() => {
      splash.classList.add("is-hiding");
      window.setTimeout(() => {
        splash.style.display = "none";
      }, 260);
    });
  };

  const maybeHide = () => {
    if (!appReady || hidden) {
      return;
    }

    const remainingMs = Math.max(0, minVisibleMs - (Date.now() - startedAt));
    window.setTimeout(hide, remainingMs);
  };

  if (!appReady) {
    window.addEventListener(
      "load",
      () => {
        appReady = true;
        maybeHide();
      },
      { once: true },
    );
  }

  maybeHide();

  window.setTimeout(() => {
    appReady = true;
    maybeHide();
  }, 8000);
})();`;

export function MobileSplashScreen() {
  return (
    <>
      <div
        id="mobile-splash-screen"
        className="mobile-splash-screen"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(circle at 50% 34%, rgba(255,255,255,0.38), transparent 23rem), radial-gradient(circle at 16% 14%, rgba(255,236,185,0.44), transparent 16rem), radial-gradient(circle at 86% 82%, rgba(118,209,118,0.52), transparent 18rem), linear-gradient(155deg, #eef9e8 0%, #bce8b4 38%, #2f8f4f 100%)",
          display: "grid",
          inset: 0,
          overflow: "hidden",
          placeItems: "center",
          pointerEvents: "none",
          position: "fixed",
          visibility: "visible",
          zIndex: 90,
        }}
      >
        <img
          className="mobile-splash-screen__logo"
          src="/brand/alexfrut-logo-icon.png"
          alt=""
          decoding="sync"
          loading="eager"
          style={{
            borderRadius: "2.5rem",
            filter: "drop-shadow(0 1.8rem 3.4rem rgba(14, 80, 42, 0.34))",
            height: "auto",
            transform: "translateZ(0)",
            width: "clamp(11rem, 48vw, 14rem)",
          }}
        />
      </div>
      <script dangerouslySetInnerHTML={{ __html: splashBootScript }} />
    </>
  );
}
