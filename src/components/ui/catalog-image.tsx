/* eslint-disable @next/next/no-img-element -- Uploaded catalog files are created after build, so raw img is safer than Next image optimization. */

import Image, { type ImageProps } from "next/image";
import { cn } from "@/lib/utils";

type CatalogImageProps = Omit<ImageProps, "src"> & {
  src: string;
};

function isRuntimeUpload(src: string) {
  return src.startsWith("/uploads/");
}

export function CatalogImage({
  src,
  alt,
  fill,
  className,
  loading,
  priority,
  ...props
}: CatalogImageProps) {
  if (isRuntimeUpload(src)) {
    return (
      <img
        src={src}
        alt={alt}
        className={cn(fill && "absolute inset-0 h-full w-full", className)}
        loading={priority || loading === "eager" ? "eager" : "lazy"}
        decoding="async"
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill={fill}
      className={className}
      loading={loading}
      priority={priority}
      {...props}
    />
  );
}
