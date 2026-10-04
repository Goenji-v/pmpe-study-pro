import type { ReactNode } from "react";

export type StudyProIconProps = {
  size?: number;
  strokeWidth?: number;
  className?: string;
};

function IconBase({
  size = 20,
  strokeWidth = 1.8,
  className,
  children,
}: StudyProIconProps & { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      className={`study-pro-icon ${className ?? ""}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export function DashboardIcon(props: StudyProIconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 2.7c2.8 2 5.4 2.8 8.2 3.2v5.4c0 5-3 8.7-8.2 10-5.2-1.3-8.2-5-8.2-10V5.9C6.6 5.5 9.2 4.7 12 2.7Z" />
      <path d="M7.7 15.7v-4.2M11.1 15.7V8.8M14.5 15.7v-2.9M17.9 15.7v-6.1" />
    </IconBase>
  );
}

export function PlanningIcon(props: StudyProIconProps) {
  return (
    <IconBase {...props}>
      <rect x="3.3" y="5.4" width="17.4" height="15.1" rx="2.2" />
      <path d="M7.4 3.5v4M16.6 3.5v4M3.6 9.4h16.8" />
      <path d="m8.1 14.7 2.4 2.3 5.2-5.2" />
    </IconBase>
  );
}

export function EditalIcon(props: StudyProIconProps) {
  return (
    <IconBase {...props}>
      <path d="M6.1 2.9h8.1l3.8 3.9v14.3H6.1z" />
      <path d="M14.2 2.9v4h3.8M8.8 11h6.5M8.8 14.3h6.5M8.8 17.6h4.2" />
    </IconBase>
  );
}

export function StudyPlanIcon(props: StudyProIconProps) {
  return (
    <IconBase {...props}>
      <circle cx="5.1" cy="18.8" r="1.6" />
      <circle cx="18.9" cy="5.2" r="1.6" />
      <path d="M6.6 18.3c2.2-.8 3.1-2.3 3.1-4.3 0-2.7 1.8-4.1 4.2-4.5 2.3-.4 3.8-1.7 4.4-3" />
      <path d="m7.1 9.7-2.2 2.2 2.2 2.2" />
    </IconBase>
  );
}

export function CalendarIcon(props: StudyProIconProps) {
  return (
    <IconBase {...props}>
      <rect x="3.2" y="5.4" width="17.6" height="15.2" rx="2.2" />
      <path d="M7.3 3.4v4M16.7 3.4v4M3.6 9.4h16.8M7.5 13.3h2M12 13.3h2M16.5 13.3h.1M7.5 16.9h2M12 16.9h2" />
    </IconBase>
  );
}

export function AIIcon(props: StudyProIconProps) {
  return (
    <IconBase {...props}>
      <path d="M9.4 3.2a3 3 0 0 0-2.8 4.2 3.2 3.2 0 0 0-1 5.9 3.3 3.3 0 0 0 3.8 5.3c.5 1.3 1.6 2.2 3 2.2" />
      <path d="M12.4 3.2a3 3 0 0 1 2.8 4.2 3.2 3.2 0 0 1 1 5.9 3.3 3.3 0 0 1-3.8 5.3" />
      <path d="M12 5.8v12.5M8.3 9.1c1.6.1 2.8.8 3.7 2M15.8 9.1c-1.6.1-2.8.8-3.7 2" />
      <path d="m17.3 14.1 2-3.6h-2.1l1.1-3.2-3 4.4h2z" />
    </IconBase>
  );
}

export function FocusIcon(props: StudyProIconProps) {
  return (
    <IconBase {...props}>
      <path d="M8.7 5.2a3 3 0 0 0-2.2 4.6 3 3 0 0 0 .9 5.5 3 3 0 0 0 4.6 2.5V6.1a3 3 0 0 0-3.3-.9Z" />
      <path d="M15.3 5.2a3 3 0 0 1 2.2 4.6 3 3 0 0 1-.9 5.5 3 3 0 0 1-4.6 2.5" />
      <path d="M4.1 6.8 2.9 9l2.5.1M19.9 17.2l1.2-2.2-2.5-.1" />
      <path d="M4 9.1A8.7 8.7 0 0 1 12 3M20 14.9A8.7 8.7 0 0 1 12 21" />
    </IconBase>
  );
}

export function BookIcon(props: StudyProIconProps) {
  return (
    <IconBase {...props}>
      <path d="M3.2 5.4c3.1-.8 5.7-.3 8.8 1.5v13c-3.1-1.8-5.7-2.3-8.8-1.5z" />
      <path d="M20.8 5.4c-3.1-.8-5.7-.3-8.8 1.5v13c3.1-1.8 5.7-2.3 8.8-1.5z" />
      <path d="M12 7v12.7" />
    </IconBase>
  );
}

export function CoursesIcon(props: StudyProIconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 5.2h13.6a2 2 0 0 1 2 2v11.6H6a2 2 0 0 1-2-2z" />
      <path d="M6 18.8a2 2 0 0 0-2 2h15.6" />
      <path d="m10 9 4.5 2.8L10 14.6z" />
    </IconBase>
  );
}

export function LibraryIcon(props: StudyProIconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 4.2h4v15.6H4zM10 4.2h4v15.6h-4zM16.2 5.2l3.6-.9 2.7 15-3.6.7z" />
      <path d="M5.2 7h1.6M11.2 7h1.6M18 8l1.5-.3" />
    </IconBase>
  );
}

export function MaterialsIcon(props: StudyProIconProps) {
  return (
    <IconBase {...props}>
      <path d="M3 6.4h6l1.7 2h10.2v9.9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M3 9.2h17.9" />
    </IconBase>
  );
}

export function ReviewsIcon(props: StudyProIconProps) {
  return (
    <IconBase {...props}>
      <path d="M8.9 6A3 3 0 0 0 6.5 10a3 3 0 0 0 .8 5.4A3 3 0 0 0 12 18V6a3 3 0 0 0-3.1 0Z" />
      <path d="M15.1 6a3 3 0 0 1 2.4 4 3 3 0 0 1-.8 5.4A3 3 0 0 1 12 18" />
      <path d="M4.2 6.9 3 9.1l2.5.1M19.8 17.1l1.2-2.2-2.5-.1" />
      <path d="M4.1 9.1A8.7 8.7 0 0 1 12 3M19.9 14.9A8.7 8.7 0 0 1 12 21" />
    </IconBase>
  );
}

export function PracticeIcon(props: StudyProIconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="8.3" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1.2" />
      <path d="m15.2 8.8 5.2-5.2M17.4 3.6h3v3" />
    </IconBase>
  );
}

export function QuestionsIcon(props: StudyProIconProps) {
  return (
    <IconBase {...props}>
      <path d="M6 2.9h8.2L18 6.8v14.3H6z" />
      <path d="M14.2 2.9v4H18" />
      <path d="M9.6 11.2a2.5 2.5 0 1 1 3.4 2.3c-.9.4-1.1 1-1.1 1.7M11.9 18.2h.1" />
    </IconBase>
  );
}

export function SimuladosIcon(props: StudyProIconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="13" r="7.8" />
      <path d="M9.3 2.8h5.4M12 5.2V3M17.6 7.4l1.5-1.5" />
      <circle cx="12" cy="13" r="3.5" />
      <path d="m12 13 3.7-2.8" />
    </IconBase>
  );
}

export function PerformanceIcon(props: StudyProIconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 19.5v-5.1h3.2v5.1zM10.2 19.5V10h3.2v9.5zM16.4 19.5V6.5h3.2v13z" />
      <path d="m4.2 10.4 4.2-4.1 3.1 2.3 6.8-5.7" />
      <path d="M15.4 2.9h3.5v3.5" />
    </IconBase>
  );
}

export function IntelligenceIcon(props: StudyProIconProps) {
  return (
    <IconBase {...props}>
      <path d="M8.8 4.8a3 3 0 0 0-2.2 4.4 3.1 3.1 0 0 0 .8 5.7 3.1 3.1 0 0 0 4.6 2.6V6a3 3 0 0 0-3.2-1.2Z" />
      <path d="M15.2 4.8a3 3 0 0 1 2.2 4.4 3.1 3.1 0 0 1-.8 5.7 3.1 3.1 0 0 1-4.6 2.6" />
      <path d="m16.9 13.7 2.5-4.3h-2.5l1-3.3-3.3 4.9h2.4z" />
      <path d="M9 8.5c1.2.2 2.2.8 3 1.8M8.8 14.2c1.3-.1 2.3-.6 3.2-1.5" />
    </IconBase>
  );
}

export function AccessIcon(props: StudyProIconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 2.8c2.7 1.9 5.4 2.8 8.1 3.2v5.2c0 5-3 8.7-8.1 10-5.1-1.3-8.1-5-8.1-10V6c2.7-.4 5.4-1.3 8.1-3.2Z" />
      <path d="m8.4 12.2 2.3 2.2 4.9-5" />
    </IconBase>
  );
}

export function SettingsIcon(props: StudyProIconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.7v2.1M12 19.2v2.1M21.3 12h-2.1M4.8 12H2.7M18.6 5.4 17.1 6.9M6.9 17.1l-1.5 1.5M18.6 18.6l-1.5-1.5M6.9 6.9 5.4 5.4" />
      <circle cx="12" cy="12" r="7.2" />
    </IconBase>
  );
}

export function PremiumIcon(props: StudyProIconProps) {
  return (
    <IconBase {...props}>
      <path d="m4 17.8-1.2-9 5 3 4.2-6 4.2 6 5-3-1.2 9z" />
      <path d="M5 20.5h14" />
    </IconBase>
  );
}
