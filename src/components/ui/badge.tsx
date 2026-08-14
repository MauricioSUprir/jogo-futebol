import * as React from "react";
import { cn } from "@/lib/utils";

export function Badge({
  className,
  style,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        className,
      )}
      style={style}
      {...props}
    >
      {children}
    </span>
  );
}

/** Badge colorido a partir de uma cor hex (fundo suave + texto/borda na cor). */
export function ColorDot({ cor, className }: { cor: string; className?: string }) {
  return (
    <span
      className={cn("inline-block h-2.5 w-2.5 rounded-full", className)}
      style={{ backgroundColor: cor }}
    />
  );
}
