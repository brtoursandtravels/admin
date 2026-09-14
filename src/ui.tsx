/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import {
  AlertCircle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Inbox,
  LoaderCircle,
} from "lucide-react";
import { Link, useBlocker, type LinkProps } from "react-router-dom";
import { ApiError, type PageMeta } from "./api";

type Toast = { id: number; tone: "success" | "error"; message: string };
const ToastContext = createContext<{
  notify: (message: string, tone?: Toast["tone"]) => void;
} | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const notify = useCallback(
    (message: string, tone: Toast["tone"] = "success") => {
      const id = Date.now() + Math.random();
      setToasts((items) => [...items, { id, tone, message }]);
      window.setTimeout(
        () => setToasts((items) => items.filter((item) => item.id !== id)),
        4500,
      );
    },
    [],
  );
  const value = useMemo(() => ({ notify }), [notify]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="fixed right-4 bottom-4 z-[100] grid max-w-[min(26rem,calc(100vw-2rem))] gap-2"
        aria-live="polite"
        aria-atomic="true"
      >
        {toasts.map((toast) => (
          <div
            className={`rounded-[0.65rem] px-4 py-3.5 text-[0.78rem] text-white shadow-admin-dialog ${
              toast.tone === "success"
                ? "bg-admin-positive"
                : "bg-admin-negative"
            }`}
            key={toast.id}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast must be used inside ToastProvider.");
  return value;
}

export function useUnsavedChanges(isDirty: boolean) {
  const blocker = useBlocker(isDirty);
  useEffect(() => {
    if (blocker.state !== "blocked") return;
    if (window.confirm("Discard your unsaved changes?")) blocker.proceed();
    else blocker.reset();
  }, [blocker]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);
}

export function Button({
  className = "",
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
}) {
  const variants = {
    primary:
      "bg-admin-brand text-white hover:not-disabled:bg-admin-brand-deep",
    secondary:
      "border-admin-border bg-admin-surface text-admin-brand hover:not-disabled:bg-admin-brand-soft",
    danger: "bg-admin-negative text-white hover:not-disabled:brightness-90",
    ghost:
      "bg-transparent text-admin-brand hover:not-disabled:bg-admin-brand-soft",
  } as const;
  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-transparent px-4 py-2.5 text-[0.84rem] font-black no-underline shadow-sm transition duration-150 active:not-disabled:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    />
  );
}

export function ActionLink({
  className = "",
  variant = "primary",
  ...props
}: LinkProps & { variant?: "primary" | "secondary" | "ghost" }) {
  const variants = {
    primary: "bg-admin-brand text-white shadow-sm hover:bg-admin-brand-deep",
    secondary:
      "border-admin-border bg-admin-surface text-admin-brand shadow-sm hover:bg-admin-brand-soft",
    ghost: "bg-transparent text-admin-brand hover:bg-admin-brand-soft",
  } as const;
  return (
    <Link
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-transparent px-4 py-2.5 text-[0.84rem] font-black no-underline transition duration-150 active:translate-y-px ${variants[variant]} ${className}`}
      {...props}
    />
  );
}

export function BackLink({
  to,
  label = "Back to list",
}: {
  to: string;
  label?: string;
}) {
  return (
    <ActionLink to={to} variant="secondary">
      <ArrowLeft size={16} aria-hidden="true" />
      {label}
    </ActionLink>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-7 flex min-w-0 items-end justify-between gap-8 border-b border-admin-border-soft pb-6 max-[760px]:flex-col max-[760px]:items-start">
      <div className="min-w-0 max-w-[54rem]">
        <p className="mb-2 text-[0.68rem] font-black uppercase tracking-[0.16em] text-admin-accent">
          {eyebrow}
        </p>
        <h1 className="m-0 text-[clamp(1.8rem,3vw,2.6rem)] font-black leading-[1.12] tracking-[-0.035em] text-admin-brand-deep">
          {title}
        </h1>
        {description ? (
          <p className="mt-3 mb-0 max-w-[48rem] text-[0.95rem] leading-7 text-admin-ink-muted">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2.5 max-[760px]:justify-start">
          {actions}
        </div>
      ) : null}
    </header>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`min-w-0 rounded-2xl border border-admin-border bg-admin-surface p-[clamp(1.2rem,2.5vw,1.75rem)] shadow-admin-card [&_h1]:m-0 [&_h1]:text-[clamp(1.7rem,3vw,2.5rem)] [&_h1]:font-black [&_h1]:text-admin-brand-deep [&_h2]:m-0 [&_h2]:text-[1.25rem] [&_h2]:font-black [&_h2]:tracking-[-0.025em] [&_h2]:text-admin-brand-deep [&_h3]:font-black [&_h3]:text-admin-brand-deep ${className}`}
    >
      {children}
    </section>
  );
}

export function StatusBadge({ value }: { value: string }) {
  const tone = ["PUBLISHED", "ACTIVE", "SENT", "CONFIRMED"].includes(value)
    ? "bg-admin-positive-soft text-admin-positive"
    : ["FAILED", "DISABLED", "LOST", "ARCHIVED", "CANCELLED"].includes(value)
      ? "bg-admin-negative-soft text-admin-negative"
      : "bg-admin-warning-soft text-admin-warning";
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[0.66rem] font-black uppercase tracking-[0.055em] ${tone}`}
    >
      {value.replaceAll("_", " ")}
    </span>
  );
}

export function LoadingPanel({
  label = "Loading current data…",
}: {
  label?: string;
}) {
  return (
    <div
      className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-admin-border bg-admin-surface/70 p-8 text-center text-[0.9rem] font-bold text-admin-ink-muted"
      role="status"
    >
      <LoaderCircle
        className="mb-3 animate-spin text-admin-brand"
        size={27}
        aria-hidden="true"
      />
      {label}
    </div>
  );
}

export function ErrorPanel({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  const detail =
    error instanceof ApiError
      ? `${error.message}${error.requestId ? ` Reference: ${error.requestId}` : ""}`
      : error instanceof Error
        ? error.message
        : "An unexpected error occurred.";
  return (
    <div
      className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-admin-negative/15 bg-admin-negative-soft/45 p-8 text-center text-admin-ink-muted [&_p]:max-w-[38rem]"
      role="alert"
    >
      <AlertCircle className="mb-3 text-admin-negative" size={28} aria-hidden="true" />
      <strong className="text-[1rem] text-admin-negative">
        Could not load this section
      </strong>
      <p className="text-[0.85rem] leading-6">{detail}</p>
      {retry ? <Button onClick={retry}>Retry</Button> : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-admin-border bg-admin-surface/65 p-8 text-center text-admin-ink-muted [&_p]:max-w-[38rem]">
      <span className="mb-3 flex size-11 items-center justify-center rounded-xl bg-admin-brand-soft text-admin-brand">
        <Inbox size={21} aria-hidden="true" />
      </span>
      <strong className="text-admin-brand-deep">{title}</strong>
      <p className="mt-2 text-[0.88rem] leading-6">{description}</p>
      {action}
    </div>
  );
}

export function Pagination({
  meta,
  onPage,
}: {
  meta: PageMeta;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(meta.total / meta.pageSize));
  return (
    <nav
      className="flex items-center justify-between border-t border-admin-border-soft px-4 py-4 text-[0.78rem] font-bold text-admin-ink-muted max-[680px]:flex-col max-[680px]:items-start max-[680px]:gap-3"
      aria-label="Pagination"
    >
      <span>
        Page {meta.page} of {pages} · {meta.total} records
      </span>
      <div className="flex items-center gap-1.5">
        <Button
          variant="secondary"
          disabled={meta.page <= 1}
          onClick={() => onPage(meta.page - 1)}
        >
          <ChevronLeft size={15} aria-hidden="true" />
          Previous
        </Button>
        <Button
          variant="secondary"
          disabled={meta.page >= pages}
          onClick={() => onPage(meta.page + 1)}
        >
          Next
          <ChevronRight size={15} aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}

export function FieldError({ message }: { message?: string }) {
  return message ? (
    <span className="text-[0.75rem] font-bold text-admin-negative" role="alert">
      {message}
    </span>
  ) : null;
}

export function ConfirmButton({
  question,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { question: string }) {
  return (
    <Button
      variant="danger"
      {...props}
      onClick={(event) => {
        if (!window.confirm(question)) return;
        props.onClick?.(event);
      }}
    >
      {children}
    </Button>
  );
}

export function formatDate(value?: string | null) {
  return value
    ? new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: value.includes("T") ? "short" : undefined,
      }).format(new Date(value))
    : "—";
}

export function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "The request could not be completed.";
}
