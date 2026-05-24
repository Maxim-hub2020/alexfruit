import Image from "next/image";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  className?: string;
  priority?: boolean;
  size?: number;
};

export function BrandLogo({ className, priority = false, size = 48 }: BrandLogoProps) {
  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-full bg-white shadow-sm ring-2 ring-white",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <Image
        src="/brand/alexfrut-logo-square.png"
        alt="АлексФрут"
        fill
        priority={priority}
        className="object-cover"
        sizes={`${size}px`}
      />
    </div>
  );
}
