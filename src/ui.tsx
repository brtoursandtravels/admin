import { AdminSelect } from "./components/AdminSelect";
/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type MouseEventHandler,
  type ReactNode,
} from "react";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Inbox,
  LoaderCircle,
  ShieldAlert,
  TriangleAlert,
  X,
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
        className="pointer-events-none fixed top-4 left-1/2 z-[100] grid w-max max-w-[min(26rem,calc(100vw-2rem))] -translate-x-1/2 justify-items-center gap-2"
        aria-live="polite"
        aria-atomic="true"
      >
        {toasts.map((toast) => (
          <div
            className={`admin-toast max-w-full rounded-[0.85rem] px-4 py-3.5 text-center text-[0.78rem] font-bold text-white shadow-admin-dialog [overflow-wrap:anywhere] ${
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

export type ConfirmationTone = "danger" | "warning" | "info";

export type ConfirmationOptions = {
  title: string;
  message: string;
  detailText?: string | null;
  confirmText?: string;
  cancelText?: string;
  tone?: ConfirmationTone;
  action?: () => unknown | Promise<unknown>;
};

type ConfirmationRequest = {
  options: ConfirmationOptions;
  resolve: (confirmed: boolean) => void;
  returnFocus: HTMLElement | null;
};

const ConfirmationContext = createContext<{
  confirm: (options: ConfirmationOptions) => Promise<boolean>;
} | null>(null);

function ConfirmationModal({
  request,
  onClose,
}: {
  request: ConfirmationRequest;
  onClose: (confirmed: boolean) => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [pending, setPending] = useState(false);
  const running = useRef(false);
  const [actionError, setActionError] = useState("");
  const options = request.options;
  const tone = options.tone ?? "danger";
  const Icon = tone === "danger" ? ShieldAlert : tone === "warning" ? TriangleAlert : AlertCircle;
  const toneClasses = {
    danger: "bg-admin-negative-soft text-admin-negative",
    warning: "bg-admin-warning-soft text-admin-warning",
    info: "bg-admin-brand-soft text-admin-brand",
  } as const;

  const runConfirmation = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setPending(true);
    setActionError("");
    try {
      await options.action?.();
      onClose(true);
    } catch (error) {
      setActionError(getErrorMessage(error));
      running.current = false;
      setPending(false);
    }
  }, [onClose, options]);

  useEffect(() => {
    const previousFocus = request.returnFocus;
    dialogRef.current?.querySelector<HTMLButtonElement>("[data-dialog-cancel]")?.focus();
    return () => { if (previousFocus?.isConnected) previousFocus.focus(); };
  }, [request]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) {
        event.preventDefault();
        onClose(false);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) { event.preventDefault(); return; }
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, pending]);

  return (
    <div
      className="admin-dialog-backdrop fixed inset-0 z-[200] flex items-center justify-center bg-admin-overlay p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target && !pending) onClose(false);
      }}
    >
      <div
        aria-describedby="confirmation-description"
        aria-labelledby="confirmation-title"
        aria-modal="true"
        className="admin-dialog-panel w-full max-w-[31rem] overflow-hidden rounded-3xl border border-white/70 bg-admin-surface shadow-admin-dialog"
        ref={dialogRef}
        role="alertdialog"
      >
        <div className="flex items-start gap-4 p-6 pb-4 sm:p-7 sm:pb-5">
          <span className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ${toneClasses[tone]}`}>
            <Icon size={23} strokeWidth={2.2} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-4">
              <h2 className="m-0 text-xl font-black tracking-[-0.025em] text-admin-brand-deep" id="confirmation-title">
                {options.title}
              </h2>
              <button
                aria-label="Close confirmation"
                className="-mt-1 inline-flex size-9 shrink-0 items-center justify-center rounded-xl border-0 bg-transparent text-admin-ink-subtle transition hover:bg-admin-surface-muted hover:text-admin-ink"
                disabled={pending}
                onClick={() => onClose(false)}
                type="button"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <p className="mt-2 mb-0 text-[0.92rem] leading-6 text-admin-ink-muted" id="confirmation-description">
              {options.message}
            </p>
            {options.detailText ? (
              <p className="mt-3 mb-0 rounded-xl bg-admin-surface-muted px-3.5 py-3 text-[0.78rem] font-bold leading-5 text-admin-ink">
                {options.detailText}
              </p>
            ) : null}
            {actionError ? (
              <p className="mt-3 mb-0 rounded-xl bg-admin-negative-soft px-3.5 py-3 text-[0.78rem] font-bold text-admin-negative" role="alert">
                {actionError}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-admin-border-soft bg-admin-surface-muted/55 px-6 py-4 sm:flex-row sm:justify-end sm:px-7">
          <Button autoFocus data-dialog-cancel disabled={pending} onClick={() => onClose(false)} type="button" variant="secondary">
            {options.cancelText ?? "Cancel"}
          </Button>
          <Button
            className={tone === "danger" ? "bg-admin-negative hover:not-disabled:bg-[#922f38]" : tone === "warning" ? "bg-admin-warning hover:not-disabled:brightness-90" : ""}
            disabled={pending}
            onClick={() => void runConfirmation()}
            type="button"
          >
            {pending ? <LoaderCircle className="animate-spin" size={17} aria-hidden="true" /> : null}
            {pending ? "Working…" : options.confirmText ?? "Confirm"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ConfirmationProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<ConfirmationRequest | null>(null);
  const confirm = useCallback((options: ConfirmationOptions) => {
    const returnFocus = document.activeElement as HTMLElement | null;
    return new Promise<boolean>((resolve) => {
      setRequest((current) => {
        current?.resolve(false);
        return { options, resolve, returnFocus };
      });
    });
  }, []);
  const close = useCallback((confirmed: boolean) => {
    setRequest((current) => {
      current?.resolve(confirmed);
      return null;
    });
  }, []);
  const value = useMemo(() => ({ confirm }), [confirm]);

  useEffect(() => {
    if (!request) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [request]);

  return (
    <ConfirmationContext.Provider value={value}>
      {children}
      {request ? <ConfirmationModal request={request} onClose={close} /> : null}
    </ConfirmationContext.Provider>
  );
}

export function useConfirm() {
  const value = useContext(ConfirmationContext);
  if (!value)
    throw new Error("useConfirm must be used inside ConfirmationProvider.");
  return value.confirm;
}

export function useUnsavedChanges(isDirty: boolean) {
  const blocker = useBlocker(isDirty);
  const confirm = useConfirm();
  const prompting = useRef(false);
  useEffect(() => {
    if (blocker.state !== "blocked" || prompting.current) return;
    prompting.current = true;
    void confirm({
      title: "Discard unsaved changes?",
      message:
        "You have edits that have not been saved. Leaving this page will permanently discard them.",
      detailText: "Stay here to keep editing, or discard the changes and continue.",
      confirmText: "Discard changes",
      cancelText: "Keep editing",
      tone: "warning",
    }).then((confirmed) => {
      prompting.current = false;
      if (confirmed) blocker.proceed();
      else blocker.reset();
    });
  }, [blocker, confirm]);
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
  const tone = ["PUBLISHED", "ACTIVE", "SENT", "CONFIRMED", "COMPLETED"].includes(value)
    ? "bg-admin-positive-soft text-admin-positive"
    : ["FAILED", "DISABLED", "LOST", "ARCHIVED", "CANCELLED"].includes(value)
      ? "bg-admin-negative-soft text-admin-negative"
      : ["NEW", "DRAFT", "PENDING", "QUEUED", "SCHEDULED"].includes(value)
        ? "bg-admin-warning-soft text-admin-warning"
        : "bg-admin-brand-soft text-admin-brand";
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
      aria-label={label}
      className="min-h-56 overflow-hidden rounded-2xl border border-admin-border bg-admin-surface p-5"
      role="status"
    >
      <span className="sr-only">{label}</span>
      <div className="mb-5 flex items-center gap-3">
        <Skeleton className="size-10 rounded-xl" />
        <div className="grid flex-1 gap-2">
          <Skeleton className="h-3.5 w-40" />
          <Skeleton className="h-2.5 w-64 max-w-full" />
        </div>
      </div>
      <div className="grid gap-3">
        {Array.from({ length: 5 }, (_, index) => (
          <div className="grid grid-cols-[2fr_1fr_1fr] gap-4 border-t border-admin-border-soft pt-3" key={index}>
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`admin-skeleton block rounded-lg bg-admin-surface-muted ${className}`}
    />
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
      {retry ? <Button type="button" onClick={retry}>Retry</Button> : null}
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
  onPageSize,
}: {
  meta: PageMeta;
  onPage: (page: number) => void;
  onPageSize?: (pageSize: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(meta.total / meta.pageSize));
  return (
    <nav
      className="flex items-center justify-between border-t border-admin-border-soft px-4 py-4 text-[0.78rem] font-bold text-admin-ink-muted max-[680px]:flex-col max-[680px]:items-start max-[680px]:gap-3"
      aria-label="Pagination"
    >
      <div className="flex flex-wrap items-center gap-3">
        <span>
          Page {meta.page} of {pages} · {meta.total} records
        </span>
        {onPageSize ? (
          <label className="flex items-center gap-2 text-[0.72rem]">
            Rows
            <AdminSelect
              aria-label="Rows per page"
              className="min-h-9 rounded-lg border border-admin-border bg-admin-surface px-2 text-admin-ink"
              onValueChange={(selectedValue) => onPageSize(Number(selectedValue))}
              value={meta.pageSize}
            >
              {[10, 25, 50, 100].map((size) => (
                <option key={size}>{size}</option>
              ))}
            </AdminSelect>
          </label>
        ) : null}
      </div>
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
  dialogTitle,
  dialogDescription,
  detailText,
  confirmText,
  cancelText,
  tone = "danger",
  onConfirm,
  onClick,
  children,
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> & {
  question?: string;
  dialogTitle?: string;
  dialogDescription?: string;
  detailText?: string | null;
  confirmText?: string;
  cancelText?: string;
  tone?: ConfirmationTone;
  onConfirm?: () => unknown | Promise<unknown>;
  onClick?: MouseEventHandler<HTMLButtonElement>;
}) {
  const confirm = useConfirm();
  return (
    <Button
      {...props}
      type={props.type ?? "button"}
      variant={tone === "danger" ? "danger" : "secondary"}
      onClick={(event) => {
        void confirm({
          title:
            dialogTitle ??
            (tone === "danger"
              ? "Confirm destructive action"
              : "Confirm this change"),
          message:
            dialogDescription ??
            question ??
            "Are you sure you want to continue?",
          detailText,
          confirmText:
            confirmText ??
            (tone === "danger" ? "Confirm permanently" : "Continue"),
          cancelText,
          tone,
          action: async () => {
            await onConfirm?.();
            await Promise.resolve(onClick?.(event));
          },
        });
      }}
    >
      {children}
    </Button>
  );
}

export function StickyActionBar({
  dirty,
  saving = false,
  children,
}: {
  dirty: boolean;
  saving?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="sticky bottom-4 z-20 mx-auto mt-5 flex w-full max-w-[48rem] flex-wrap items-center justify-between gap-3 rounded-2xl border border-admin-border/90 bg-admin-surface/95 px-4 py-3 shadow-admin-dialog backdrop-blur-xl">
      <span className="inline-flex items-center gap-2 text-[0.76rem] font-black text-admin-ink-muted">
        <span
          className={`flex size-7 items-center justify-center rounded-full ${dirty ? "bg-admin-warning-soft text-admin-warning" : "bg-admin-positive-soft text-admin-positive"}`}
        >
          {saving ? (
            <LoaderCircle className="animate-spin" size={14} aria-hidden="true" />
          ) : dirty ? (
            <span className="size-2 rounded-full bg-current" />
          ) : (
            <Check size={14} aria-hidden="true" />
          )}
        </span>
        {saving
          ? "Saving changes…"
          : dirty
            ? "Unsaved changes"
            : "All changes saved"}
      </span>
      <div className="flex flex-wrap items-center justify-end gap-2">{children}</div>
    </div>
  );
}

export function SavedIndicator() {
  return (
    <span className="inline-flex items-center gap-1.5 text-[0.72rem] font-bold text-admin-positive">
      <CheckCircle2 size={15} aria-hidden="true" /> Saved
    </span>
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
