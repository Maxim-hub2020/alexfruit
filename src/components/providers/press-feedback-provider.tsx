"use client";

import { useEffect } from "react";

const PRESSABLE_SELECTOR =
  "button:not(:disabled), a[href], [role='button']:not([aria-disabled='true'])";
const PRESS_CLASS = "press-feedback-active";

function getPressableTarget(event: Event) {
  for (const target of event.composedPath()) {
    if (target instanceof HTMLElement && target.matches(PRESSABLE_SELECTOR)) {
      return target;
    }

    if (target instanceof Element) {
      const pressable = target.closest<HTMLElement>(PRESSABLE_SELECTOR);

      if (pressable) {
        return pressable;
      }
    }
  }

  return null;
}

function releasePressFeedback(target: HTMLElement | null) {
  if (!target) {
    return;
  }

  target.classList.remove(PRESS_CLASS);
}

export function PressFeedbackProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    let activeTarget: HTMLElement | null = null;
    let releaseTimer: ReturnType<typeof globalThis.setTimeout> | null = null;

    function clearReleaseTimer() {
      if (!releaseTimer) {
        return;
      }

      globalThis.clearTimeout(releaseTimer);
      releaseTimer = null;
    }

    function scheduleRelease(target: HTMLElement | null) {
      clearReleaseTimer();
      releaseTimer = globalThis.setTimeout(() => {
        releasePressFeedback(target);

        if (activeTarget === target) {
          activeTarget = null;
        }
      }, 180);
    }

    function handlePointerDown(event: PointerEvent) {
      if (event.button !== 0) {
        return;
      }

      releasePressFeedback(activeTarget);
      activeTarget = getPressableTarget(event);

      if (!activeTarget) {
        return;
      }

      clearReleaseTimer();
      activeTarget.classList.add(PRESS_CLASS);
    }

    function handlePointerRelease() {
      scheduleRelease(activeTarget);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      activeTarget = getPressableTarget(event);
      activeTarget?.classList.add(PRESS_CLASS);
    }

    function handleKeyUp() {
      scheduleRelease(activeTarget);
    }

    document.addEventListener("pointerdown", handlePointerDown, { capture: true });
    document.addEventListener("pointerup", handlePointerRelease, { capture: true });
    document.addEventListener("pointercancel", handlePointerRelease, { capture: true });
    document.addEventListener("pointerleave", handlePointerRelease, { capture: true });
    document.addEventListener("keydown", handleKeyDown, { capture: true });
    document.addEventListener("keyup", handleKeyUp, { capture: true });

    return () => {
      clearReleaseTimer();
      releasePressFeedback(activeTarget);
      document.removeEventListener("pointerdown", handlePointerDown, { capture: true });
      document.removeEventListener("pointerup", handlePointerRelease, { capture: true });
      document.removeEventListener("pointercancel", handlePointerRelease, { capture: true });
      document.removeEventListener("pointerleave", handlePointerRelease, { capture: true });
      document.removeEventListener("keydown", handleKeyDown, { capture: true });
      document.removeEventListener("keyup", handleKeyUp, { capture: true });
    };
  }, []);

  return children;
}
