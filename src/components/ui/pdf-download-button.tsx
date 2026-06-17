"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type PdfDownloadButtonProps = {
  href: string;
  filename: string;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  loadingLabel?: string;
  title?: string;
};

function normalizeFilename(filename: string) {
  const normalized = filename.trim().replace(/[\\/:*?"<>|]+/g, "-");

  return normalized.toLowerCase().endsWith(".pdf")
    ? normalized
    : `${normalized || "alexfruit-labels"}.pdf`;
}

function isIosDevice() {
  if (typeof navigator === "undefined") {
    return false;
  }

  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function PdfDownloadButton({
  href,
  filename,
  children,
  className,
  disabled = false,
  loadingLabel = "Готовим PDF...",
  title = "Этикетки AlexFruit",
}: PdfDownloadButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  async function downloadPdf() {
    if (disabled || isLoading) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(href, {
        credentials: "include",
        headers: {
          Accept: "application/pdf",
        },
      });

      if (!response.ok) {
        throw new Error("Не удалось сформировать PDF. Попробуйте ещё раз.");
      }

      const sourceBlob = await response.blob();
      const pdfBlob =
        sourceBlob.type === "application/pdf"
          ? sourceBlob
          : new Blob([sourceBlob], { type: "application/pdf" });
      const safeFilename = normalizeFilename(filename);
      const file = new File([pdfBlob], safeFilename, { type: "application/pdf" });
      const shareNavigator = navigator as Navigator & {
        canShare?: (data: ShareData) => boolean;
      };

      if (
        typeof navigator.share === "function" &&
        shareNavigator.canShare?.({ files: [file] })
      ) {
        await navigator.share({
          files: [file],
          title,
        });
        return;
      }

      const url = URL.createObjectURL(pdfBlob);

      if (isIosDevice()) {
        window.location.assign(url);
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
        return;
      }

      const link = document.createElement("a");
      link.href = url;
      link.download = safeFilename;
      document.body.append(link);
      link.click();
      link.remove();

      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Не удалось сформировать PDF.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={downloadPdf}
      disabled={disabled || isLoading}
      aria-busy={isLoading}
      className={cn(className, "disabled:cursor-not-allowed disabled:opacity-60")}
    >
      {isLoading ? loadingLabel : children}
    </button>
  );
}
