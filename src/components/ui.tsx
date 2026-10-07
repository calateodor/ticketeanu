import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export { cx };

type Variant = "primary" | "secondary" | "ghost" | "danger" | "uv" | "night";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-(--radius-control) font-semibold transition-[background-color,transform,box-shadow] duration-150 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap";

const variants: Record<Variant, string> = {
  primary: "bg-stamp text-white hover:bg-stamp-deep shadow-[0_6px_16px_-8px_rgba(91,63,209,0.8)]",
  secondary: "bg-surface text-ink border border-line-strong hover:bg-paper",
  ghost: "bg-transparent text-ink-2 hover:bg-stamp-soft",
  danger: "bg-danger-soft text-danger hover:bg-[#f7d4d4]",
  uv: "bg-uv text-white hover:bg-uv-deep shadow-[0_8px_24px_-8px_rgba(255,77,109,0.7)]",
  night: "bg-white text-night hover:bg-[#e9e6f5]",
};

const sizes: Record<Size, string> = {
  sm: "text-sm px-3 py-1.5",
  md: "text-[15px] px-4 py-2.5",
  lg: "text-base px-6 py-3.5",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button className={cx(base, variants[variant], sizes[size], className)} {...props} />;
}

export function LinkButton({
  variant = "primary",
  size = "md",
  className,
  href,
  children,
  ...props
}: Omit<ComponentProps<typeof Link>, "href"> & { href: string; variant?: Variant; size?: Size }) {
  return (
    <Link href={href} className={cx(base, variants[variant], sizes[size], className)} {...props}>
      {children}
    </Link>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx("rounded-(--radius-card) bg-surface border border-line shadow-(--shadow-card)", className)}>{children}</div>;
}

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cx("block text-sm font-semibold text-ink-2 mb-1.5", className)} {...props} />;
}

export function Hint({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx("text-sm text-muted mt-1.5", className)}>{children}</p>;
}

export function ErrorText({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="text-sm font-medium text-danger mt-1.5">
      {children}
    </p>
  );
}

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  error?: ReactNode;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? <ErrorText>{error}</ErrorText> : hint ? <Hint>{hint}</Hint> : null}
    </div>
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cx("field", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cx("field min-h-28", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cx("field", className)} {...props} />;
}

type Tone = "neutral" | "ok" | "warn" | "danger" | "stamp" | "uv";
const tones: Record<Tone, string> = {
  neutral: "bg-paper text-ink-2 border border-line",
  ok: "bg-ok-soft text-[#0f6e56]",
  warn: "bg-warn-soft text-[#854f0b]",
  danger: "bg-danger-soft text-[#a32d2d]",
  stamp: "bg-stamp-soft text-stamp-deep",
  uv: "bg-[#ffe3e9] text-[#b3123a]",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", tones[tone], className)}>
      {children}
    </span>
  );
}

export function Stamp({ children, className, animate = false, color }: { children: ReactNode; className?: string; animate?: boolean; color?: string }) {
  return (
    <span className={cx("stamp", animate && "stamp-in", className)} style={color ? { color } : undefined} aria-hidden="false">
      {children}
    </span>
  );
}

export function Logo({ className, textClassName, dark = false }: { className?: string; textClassName?: string; dark?: boolean }) {
  return (
    <span className={cx("inline-flex items-center gap-2 font-display font-extrabold tracking-tight text-lg", dark ? "text-white" : "text-ink", className)}>
      <span
        className={cx(
          "inline-grid place-items-center size-7 rounded-md border-[2.5px] -rotate-6 text-[11px] leading-none font-black",
          dark ? "border-uv text-uv" : "border-stamp text-stamp",
        )}
        aria-hidden="true"
      >
        T
      </span>
      <span className={textClassName}>Ticketeanu</span>
    </span>
  );
}

export function PageTitle({ children, sub, actions }: { children: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        <h1 className="text-3xl md:text-4xl font-extrabold leading-tight">{children}</h1>
        {sub ? <p className="text-muted mt-1">{sub}</p> : null}
      </div>
      {actions ? <div className="flex gap-2">{actions}</div> : null}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="rounded-(--radius-card) bg-surface border border-line p-4">
      <p className="text-xs uppercase tracking-wider text-muted font-semibold">{label}</p>
      <p className="text-3xl font-extrabold font-display tabular mt-1">{value}</p>
      {hint ? <p className="text-sm text-muted mt-1">{hint}</p> : null}
    </div>
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-(--radius-card) border border-dashed border-line-strong p-8 text-center">
      <p className="font-display font-bold text-lg">{title}</p>
      {children ? <p className="text-muted mt-1 max-w-md mx-auto">{children}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
