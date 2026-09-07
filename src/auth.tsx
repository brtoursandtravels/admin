/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { apiRequest, type DataResponse } from "./api";
import type { AdminUser, Role } from "./types";

type LoginResult = { user: AdminUser; csrfToken: string; expiresAt: string };
type AuthContextValue = {
  user: AdminUser | null;
  csrfToken: string;
  loading: boolean;
  sessionExpired: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  forgotPassword: (email: string) => Promise<string>;
  resetPassword: (token: string, password: string) => Promise<string>;
  refresh: () => Promise<void>;
  clearExpiredNotice: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function preAuthCsrf() {
  return apiRequest<
    DataResponse<{ csrfToken: string; authenticated: boolean }>
  >("/auth/csrf", { authenticated: false });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [csrfToken, setCsrfToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  const restore = useCallback(async () => {
    try {
      const csrf = await preAuthCsrf();
      setCsrfToken(csrf.data.csrfToken);
      if (csrf.data.authenticated) {
        const me =
          await apiRequest<DataResponse<{ user: AdminUser }>>("/auth/me");
        setUser(me.data.user);
      }
    } catch {
      setUser(null);
      setCsrfToken("");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void restore();
  }, [restore]);
  useEffect(() => {
    const expire = () => {
      setUser(null);
      setCsrfToken("");
      setSessionExpired(true);
    };
    window.addEventListener("br:session-expired", expire);
    return () => window.removeEventListener("br:session-expired", expire);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      csrfToken,
      loading,
      sessionExpired,
      clearExpiredNotice: () => setSessionExpired(false),
      refresh: restore,
      login: async (email, password) => {
        const csrf = await preAuthCsrf();
        const result = await apiRequest<DataResponse<LoginResult>>(
          "/auth/login",
          {
            method: "POST",
            body: { email, password },
            csrfToken: csrf.data.csrfToken,
            authenticated: false,
          },
        );
        setUser(result.data.user);
        setCsrfToken(result.data.csrfToken);
        setSessionExpired(false);
      },
      logout: async () => {
        try {
          await apiRequest<void>("/auth/logout", { method: "POST", csrfToken });
        } finally {
          setUser(null);
          setCsrfToken("");
        }
      },
      forgotPassword: async (email) => {
        const csrf = await preAuthCsrf();
        const result = await apiRequest<DataResponse<{ message: string }>>(
          "/auth/forgot-password",
          {
            method: "POST",
            body: { email },
            csrfToken: csrf.data.csrfToken,
            authenticated: false,
          },
        );
        return result.data.message;
      },
      resetPassword: async (token, password) => {
        const csrf = await preAuthCsrf();
        const result = await apiRequest<DataResponse<{ message: string }>>(
          "/auth/reset-password",
          {
            method: "POST",
            body: { token, password },
            csrfToken: csrf.data.csrfToken,
            authenticated: false,
          },
        );
        return result.data.message;
      },
    }),
    [csrfToken, loading, restore, sessionExpired, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider.");
  return value;
}

export function RequireAuth() {
  const auth = useAuth();
  const location = useLocation();
  if (auth.loading)
    return (
      <div className="flex min-h-screen items-center justify-center bg-admin-canvas font-bold text-admin-brand" role="status">
        Restoring your secure session…
      </div>
    );
  if (!auth.user)
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

export function RequireRoles({ roles }: { roles: Role[] }) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role))
    return <Navigate to="/forbidden" replace />;
  return <Outlet />;
}
