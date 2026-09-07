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
import { useBlocker } from "react-router-dom";
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
      className={`inline-flex min-h-[2.6rem] items-center justify-center gap-2 rounded-[0.6rem] border border-transparent px-4 py-2.5 font-bold no-underline transition duration-150 active:not-disabled:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    />
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
    <header className="mb-8 flex items-end justify-between gap-8 max-[680px]:flex-col max-[680px]:items-start">
      <div className="max-w-[50rem]">
        <p className="mb-[0.45rem] text-[0.66rem] font-black uppercase tracking-[0.14em] text-admin-accent">
          {eyebrow}
        </p>
        <h1 className="m-0 font-display text-[clamp(2rem,4vw,3.2rem)] font-medium leading-[1.08] text-admin-brand-deep">
          {title}
        </h1>
        {description ? (
          <p className="mt-3.5 mb-0 leading-relaxed text-admin-ink-muted">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center justify-end gap-2.5 max-[680px]:justify-start">
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
      className={`rounded-[0.9rem] border border-admin-border bg-admin-surface p-[clamp(1.25rem,3vw,1.9rem)] shadow-admin-card [&_h1]:m-0 [&_h1]:font-display [&_h1]:text-[clamp(1.8rem,4vw,2.8rem)] [&_h1]:font-medium [&_h1]:text-admin-brand-deep [&_h2]:m-0 [&_h2]:font-display [&_h2]:text-[1.45rem] [&_h2]:font-medium [&_h2]:text-admin-brand-deep [&_h3]:text-admin-brand-deep ${className}`}
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
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[0.62rem] font-extrabold uppercase tracking-[0.04em] ${tone}`}
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
      className="flex min-h-56 flex-col items-center justify-center p-8 text-center text-admin-ink-muted"
      role="status"
    >
      <span
        className="mb-3 h-7 w-7 animate-spin rounded-full border-[3px] border-admin-brand-soft border-t-admin-brand"
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
      className="flex min-h-56 flex-col items-center justify-center p-8 text-center text-admin-ink-muted [&_p]:max-w-[38rem]"
      role="alert"
    >
      <strong className="text-admin-negative">Could not load this section</strong>
      <p>{detail}</p>
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
    <div className="flex min-h-56 flex-col items-center justify-center p-8 text-center text-admin-ink-muted [&_p]:max-w-[38rem]">
      <strong>{title}</strong>
      <p>{description}</p>
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
      className="flex items-center justify-between border-t border-admin-border-soft px-4 py-3.5 text-xs text-admin-ink-muted max-[680px]:flex-col max-[680px]:items-start max-[680px]:gap-3"
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
          Previous
        </Button>
        <Button
          variant="secondary"
          disabled={meta.page >= pages}
          onClick={() => onPage(meta.page + 1)}
        >
          Next
        </Button>
      </div>
    </nav>
  );
}

export function FieldError({ message }: { message?: string }) {
  return message ? (
    <span className="text-[0.7rem] font-semibold text-admin-negative" role="alert">
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
