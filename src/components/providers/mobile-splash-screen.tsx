const splashBootScript = `(() => {
  const splash = document.getElementById("mobile-splash-screen");
  const video = document.getElementById("mobile-splash-video");

  if (!splash || !(video instanceof HTMLVideoElement)) {
    return;
  }

  const isMobile = window.matchMedia("(max-width: 767px)").matches;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!isMobile || reduceMotion) {
    splash.remove();
    return;
  }

  const startedAt = Date.now();
  const minVisibleMs = 900;
  let pageReady = document.readyState === "complete";
  let videoDone = false;
  let hidden = false;

  const hide = () => {
    if (hidden) {
      return;
    }

    hidden = true;
    const remainingMs = Math.max(0, minVisibleMs - (Date.now() - startedAt));

    window.setTimeout(() => {
      splash.classList.add("is-hiding");
      window.setTimeout(() => splash.remove(), 520);
    }, remainingMs);
  };

  const maybeHide = () => {
    if (pageReady && videoDone) {
      hide();
    }
  };

  const markPageReady = () => {
    pageReady = true;
    maybeHide();
  };

  const markVideoDone = () => {
    videoDone = true;
    maybeHide();
  };

  const markVideoReady = () => {
    splash.classList.add("is-video-ready");
  };

  if (!pageReady) {
    window.addEventListener("load", markPageReady, { once: true });
  }

  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    markVideoReady();
  } else {
    video.addEventListener("loadeddata", markVideoReady, { once: true });
  }

  if (video.ended) {
    markVideoDone();
  } else {
    video.addEventListener("ended", markVideoDone, { once: true });
    video.addEventListener("error", () => window.setTimeout(markVideoDone, 650), {
      once: true,
    });
  }

  const playPromise = video.play();

  if (playPromise && typeof playPromise.catch === "function") {
    playPromise.catch(() => {
      video.muted = true;
      video.play().catch(() => {
        window.setTimeout(markVideoDone, 3500);
      });
    });
  }

  window.setTimeout(() => {
    pageReady = true;
    videoDone = true;
    hide();
  }, 14000);
})();`;

export function MobileSplashScreen() {
  return (
    <>
      <div
        id="mobile-splash-screen"
        className="mobile-splash-screen"
        aria-hidden="true"
      >
        <video
          id="mobile-splash-video"
          className="mobile-splash-screen__video"
          src="/splash/alexfrut-intro.mp4"
          poster="/brand/alexfrut-logo-square.png"
          autoPlay
          muted
          playsInline
          preload="auto"
        />
      </div>
      <script dangerouslySetInnerHTML={{ __html: splashBootScript }} />
    </>
  );
}
