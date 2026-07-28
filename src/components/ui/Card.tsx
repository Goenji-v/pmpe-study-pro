import type {
  HTMLAttributes,
  ReactNode,
} from "react";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  highlighted?: boolean;
};

export default function Card({
  children,
  title,
  subtitle,
  highlighted = false,
  className = "",
  ...props
}: CardProps) {
  const classes = [
    "ui-card",
    highlighted ? "ui-card-highlighted" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} {...props}>
      {(title || subtitle) && (
        <div className="ui-card-header">
          {title && <h2>{title}</h2>}

          {subtitle && <p>{subtitle}</p>}
        </div>
      )}

      <div className="ui-card-content">
        {children}
      </div>
    </div>
  );
}