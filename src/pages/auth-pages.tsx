import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { z } from "zod";
import { useAuth } from "../auth";
import { Button, FieldError, getErrorMessage } from "../ui";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});
type LoginInput = z.infer<typeof loginSchema>;

function AuthLayout({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <main className="grid min-h-screen grid-cols-[minmax(18rem,0.85fr)_minmax(20rem,1.15fr)] bg-admin-canvas max-[680px]:grid-cols-1">
      <section className="flex flex-col items-center justify-center bg-admin-brand-deep p-[clamp(2rem,7vw,6rem)] text-center text-admin-on-brand max-[680px]:hidden [&_img]:h-auto [&_img]:w-[min(100%,26rem)] [&_img]:max-w-[26rem] [&_img]:shadow-admin-dialog [&_p]:mt-6 [&_p]:max-w-96 [&_p]:leading-relaxed">
        <img
          src={import.meta.env.BASE_URL + "br-logo.png"}
          alt="BR Tours and Travels"
        />
        <p>
          Secure content and enquiry operations for authorised BR Tours staff.
        </p>
      </section>
      <section className="flex items-center justify-center p-[clamp(1.5rem,6vw,5rem)]">
        <div className="w-full max-w-[31rem] [&_h1]:m-0 [&_h1]:font-display [&_h1]:text-[clamp(2rem,4vw,3.2rem)] [&_h1]:font-medium [&_h1]:leading-tight [&_h1]:text-admin-brand-deep [&>p:not(:first-child)]:mt-4 [&>p:not(:first-child)]:leading-relaxed [&>p:not(:first-child)]:text-admin-ink-muted">
          <p className="mb-[0.45rem] text-[0.66rem] font-black uppercase tracking-[0.14em] text-admin-accent">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{description}</p>
          {children}
        </div>
      </section>
    </main>
  );
}

export function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState("");
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });
  if (!auth.loading && auth.user) return <Navigate to="/" replace />;
  const submit = form.handleSubmit(async (input) => {
    setError("");
    try {
      await auth.login(input.email, input.password);
      const from = (location.state as { from?: string } | null)?.from ?? "/";
      navigate(from, { replace: true });
    } catch (cause) {
      setError(getErrorMessage(cause));
    }
  });
  return (
    <AuthLayout
      eyebrow="Authorised staff"
      title="Welcome back."
      description="Sign in with the account created by your Super Admin."
    >
      {auth.sessionExpired ? (
        <div className="mt-4 rounded-[0.6rem] bg-admin-negative-soft p-3 text-[0.78rem] text-admin-negative" role="alert">
          Your session expired. Please sign in again.
        </div>
      ) : null}
      {error ? (
        <div className="mt-4 rounded-[0.6rem] bg-admin-negative-soft p-3 text-[0.78rem] text-admin-negative" role="alert">
          {error}
        </div>
      ) : null}
      <form className="mt-6 grid gap-4 [&_label]:grid [&_label]:gap-1.5 [&_label]:text-[0.79rem] [&_label]:font-bold [&_label]:text-admin-brand-deep [&_input]:min-h-[2.7rem] [&_input]:w-full [&_input]:rounded-[0.55rem] [&_input]:border [&_input]:border-admin-border [&_input]:bg-admin-surface [&_input]:px-3 [&_input]:py-2.5 [&_input]:text-admin-ink [&_select]:min-h-[2.7rem] [&_select]:w-full [&_select]:rounded-[0.55rem] [&_select]:border [&_select]:border-admin-border [&_select]:bg-admin-surface [&_select]:px-3 [&_select]:py-2.5 [&_select]:text-admin-ink [&_textarea]:min-h-32 [&_textarea]:w-full [&_textarea]:resize-y [&_textarea]:rounded-[0.55rem] [&_textarea]:border [&_textarea]:border-admin-border [&_textarea]:bg-admin-surface [&_textarea]:px-3 [&_textarea]:py-2.5 [&_textarea]:leading-relaxed [&_textarea]:text-admin-ink [&_input:focus]:border-admin-brand [&_input:focus]:outline-2 [&_input:focus]:outline-admin-brand-soft [&_select:focus]:border-admin-brand [&_select:focus]:outline-2 [&_select:focus]:outline-admin-brand-soft [&_textarea:focus]:border-admin-brand [&_textarea:focus]:outline-2 [&_textarea:focus]:outline-admin-brand-soft" onSubmit={submit} noValidate>
        <label>
          Email address
          <input
            autoComplete="username"
            type="email"
            {...form.register("email")}
          />
          <FieldError message={form.formState.errors.email?.message} />
        </label>
        <label>
          Password
          <input
            autoComplete="current-password"
            type="password"
            {...form.register("password")}
          />
          <FieldError message={form.formState.errors.password?.message} />
        </label>
        <Button disabled={form.formState.isSubmitting} type="submit">
          {form.formState.isSubmitting ? "Signing in…" : "Sign in securely"}
        </Button>
      </form>
      <Link className="mt-5 inline-block text-[0.78rem] font-bold text-admin-brand hover:text-admin-accent" to="/forgot-password">
        Forgot your password?
      </Link>
    </AuthLayout>
  );
}

const forgotSchema = z.object({
  email: z.string().email("Enter a valid email address."),
});
export function ForgotPasswordPage() {
  const { forgotPassword } = useAuth();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const form = useForm<z.infer<typeof forgotSchema>>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: "" },
  });
  return (
    <AuthLayout
      eyebrow="Account recovery"
      title="Reset your password."
      description="If an active account exists, a secure, single-use link will be queued for delivery."
    >
      {message ? (
        <div className="mt-4 rounded-[0.6rem] bg-admin-positive-soft p-3 text-[0.78rem] text-admin-positive" role="status">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="mt-4 rounded-[0.6rem] bg-admin-negative-soft p-3 text-[0.78rem] text-admin-negative" role="alert">
          {error}
        </div>
      ) : null}
      <form
        className="mt-6 grid gap-4 [&_label]:grid [&_label]:gap-1.5 [&_label]:text-[0.79rem] [&_label]:font-bold [&_label]:text-admin-brand-deep [&_input]:min-h-[2.7rem] [&_input]:w-full [&_input]:rounded-[0.55rem] [&_input]:border [&_input]:border-admin-border [&_input]:bg-admin-surface [&_input]:px-3 [&_input]:py-2.5 [&_input]:text-admin-ink [&_select]:min-h-[2.7rem] [&_select]:w-full [&_select]:rounded-[0.55rem] [&_select]:border [&_select]:border-admin-border [&_select]:bg-admin-surface [&_select]:px-3 [&_select]:py-2.5 [&_select]:text-admin-ink [&_textarea]:min-h-32 [&_textarea]:w-full [&_textarea]:resize-y [&_textarea]:rounded-[0.55rem] [&_textarea]:border [&_textarea]:border-admin-border [&_textarea]:bg-admin-surface [&_textarea]:px-3 [&_textarea]:py-2.5 [&_textarea]:leading-relaxed [&_textarea]:text-admin-ink [&_input:focus]:border-admin-brand [&_input:focus]:outline-2 [&_input:focus]:outline-admin-brand-soft [&_select:focus]:border-admin-brand [&_select:focus]:outline-2 [&_select:focus]:outline-admin-brand-soft [&_textarea:focus]:border-admin-brand [&_textarea:focus]:outline-2 [&_textarea:focus]:outline-admin-brand-soft"
        onSubmit={form.handleSubmit(async ({ email }) => {
          setError("");
          try {
            setMessage(await forgotPassword(email));
          } catch (cause) {
            setError(getErrorMessage(cause));
          }
        })}
        noValidate
      >
        <label>
          Email address
          <input
            autoComplete="email"
            type="email"
            {...form.register("email")}
          />
          <FieldError message={form.formState.errors.email?.message} />
        </label>
        <Button disabled={form.formState.isSubmitting} type="submit">
          Send reset instructions
        </Button>
      </form>
      <Link className="mt-5 inline-block text-[0.78rem] font-bold text-admin-brand hover:text-admin-accent" to="/login">
        Return to sign in
      </Link>
    </AuthLayout>
  );
}

const resetSchema = z
  .object({
    password: z.string().min(14, "Use at least 14 characters.").max(128),
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });
export function ResetPasswordPage() {
  const { resetPassword } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const token = params.get("token") ?? "";
  const form = useForm<z.infer<typeof resetSchema>>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });
  return (
    <AuthLayout
      eyebrow="Account recovery"
      title="Choose a new password."
      description="The link is single-use and expires automatically."
    >
      {!token ? (
        <div className="mt-4 rounded-[0.6rem] bg-admin-negative-soft p-3 text-[0.78rem] text-admin-negative" role="alert">
          This reset link does not contain a token.
        </div>
      ) : null}
      {error ? (
        <div className="mt-4 rounded-[0.6rem] bg-admin-negative-soft p-3 text-[0.78rem] text-admin-negative" role="alert">
          {error}
        </div>
      ) : null}
      <form
        className="mt-6 grid gap-4 [&_label]:grid [&_label]:gap-1.5 [&_label]:text-[0.79rem] [&_label]:font-bold [&_label]:text-admin-brand-deep [&_input]:min-h-[2.7rem] [&_input]:w-full [&_input]:rounded-[0.55rem] [&_input]:border [&_input]:border-admin-border [&_input]:bg-admin-surface [&_input]:px-3 [&_input]:py-2.5 [&_input]:text-admin-ink [&_select]:min-h-[2.7rem] [&_select]:w-full [&_select]:rounded-[0.55rem] [&_select]:border [&_select]:border-admin-border [&_select]:bg-admin-surface [&_select]:px-3 [&_select]:py-2.5 [&_select]:text-admin-ink [&_textarea]:min-h-32 [&_textarea]:w-full [&_textarea]:resize-y [&_textarea]:rounded-[0.55rem] [&_textarea]:border [&_textarea]:border-admin-border [&_textarea]:bg-admin-surface [&_textarea]:px-3 [&_textarea]:py-2.5 [&_textarea]:leading-relaxed [&_textarea]:text-admin-ink [&_input:focus]:border-admin-brand [&_input:focus]:outline-2 [&_input:focus]:outline-admin-brand-soft [&_select:focus]:border-admin-brand [&_select:focus]:outline-2 [&_select:focus]:outline-admin-brand-soft [&_textarea:focus]:border-admin-brand [&_textarea:focus]:outline-2 [&_textarea:focus]:outline-admin-brand-soft"
        onSubmit={form.handleSubmit(async ({ password }) => {
          setError("");
          try {
            await resetPassword(token, password);
            navigate("/login", {
              replace: true,
              state: { resetComplete: true },
            });
          } catch (cause) {
            setError(getErrorMessage(cause));
          }
        })}
        noValidate
      >
        <label>
          New password
          <input
            autoComplete="new-password"
            type="password"
            {...form.register("password")}
          />
          <FieldError message={form.formState.errors.password?.message} />
        </label>
        <label>
          Confirm new password
          <input
            autoComplete="new-password"
            type="password"
            {...form.register("confirmPassword")}
          />
          <FieldError
            message={form.formState.errors.confirmPassword?.message}
          />
        </label>
        <Button disabled={!token || form.formState.isSubmitting} type="submit">
          Update password
        </Button>
      </form>
      <Link className="mt-5 inline-block text-[0.78rem] font-bold text-admin-brand hover:text-admin-accent" to="/login">
        Return to sign in
      </Link>
    </AuthLayout>
  );
}
