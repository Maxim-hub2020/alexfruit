/* eslint-disable @next/next/no-img-element -- Launch splash needs the preloaded raw icon before the app hydrates. */

const splashBootScript = `(() => {
  const splash = document.getElementById("mobile-splash-screen");

  if (!splash) {
    return;
  }

  const isMobile = window.matchMedia("(max-width: 767px)").matches;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!isMobile || reduceMotion) {
    splash.remove();
    return;
  }

  let hidden = false;

  const hide = () => {
    if (hidden) {
      return;
    }

    hidden = true;
    window.requestAnimationFrame(() => {
      splash.classList.add("is-hiding");
      window.setTimeout(() => splash.remove(), 260);
    });
  };

  if (document.readyState === "complete") {
    hide();
  } else {
    window.addEventListener("load", hide, { once: true });
  }
})();`;

export function MobileSplashScreen() {
  return (
    <>
      <div
        id="mobile-splash-screen"
        className="mobile-splash-screen"
        aria-hidden="true"
      >
        <img
          className="mobile-splash-screen__logo"
          src="/brand/alexfrut-logo-icon.png"
          alt=""
          decoding="sync"
          loading="eager"
        />
      </div>
      <script dangerouslySetInnerHTML={{ __html: splashBootScript }} />
    </>
  );
}
