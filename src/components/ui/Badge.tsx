import type { ReactNode } from "react";

type BadgeVariant =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral";

type BadgeProps = {
  children: ReactNode;
  variant?: BadgeVariant;
};

export default function Badge({
  children,
  variant = "neutral",
}: BadgeProps) {
  return (
    <span className={`ui-badge ui-badge-${variant}`}>
      {children}
    </span>
  );
}