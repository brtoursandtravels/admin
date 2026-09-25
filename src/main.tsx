import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";
import "@fontsource/lato/400.css";
import "@fontsource/lato/700.css";
import "@fontsource/lato/900.css";
import { AuthProvider, RequireAuth, RequireRoles } from "./auth";
import {
  ForgotPasswordPage,
  LoginPage,
  ResetPasswordPage,
} from "./pages/auth-pages";
import {
  DashboardPage,
  ForbiddenPage,
  NotFoundPage,
} from "./pages/dashboard-pages";
import { AppShell } from "./shell";
import { ConfirmationProvider, ToastProvider } from "./ui";
import "./globals.css";

const PackagesPage = lazy(() =>
  import("./pages/package-pages").then((module) => ({
    default: module.PackagesPage,
  })),
);
const PackageEditorPage = lazy(() =>
  import("./pages/package-pages").then((module) => ({
    default: module.PackageEditorPage,
  })),
);
const PackagePreviewPage = lazy(() =>
  import("./pages/package-pages").then((module) => ({
    default: module.PackagePreviewPage,
  })),
);
const CategoriesPage = lazy(() =>
  import("./pages/catalogue-pages").then((module) => ({
    default: module.CategoriesPage,
  })),
);
const MediaLibraryPage = lazy(() => import("./pages/MediaLibraryPage"));
const GalleryAlbumsPage = lazy(() => import("./pages/GalleryAlbumsPage"));
const BlogPage = lazy(() => import("./pages/BlogPage"));
const EngagementPage = lazy(() =>
  import("./pages/content-pages").then((module) => ({
    default: module.EngagementPage,
  })),
);
const SettingsPage = lazy(() => import("./pages/PublicSettingsPage"));
const PageSeoPage = lazy(() =>
  import("./pages/seo-pages").then((module) => ({ default: module.PageSeoPage })),
);
const EnquiriesPage = lazy(() => import("./pages/EnquiriesPage"));
const EnquiryDetailPage = lazy(() =>
  import("./pages/sales-pages").then((module) => ({
    default: module.EnquiryDetailPage,
  })),
);
const UsersPage = lazy(() =>
  import("./pages/operations-pages").then((module) => ({
    default: module.UsersPage,
  })),
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 15_000, refetchOnWindowFocus: false },
  },
});
const router = createBrowserRouter(
  [
    { path: "/login", element: <LoginPage /> },
    { path: "/forgot-password", element: <ForgotPasswordPage /> },
    { path: "/reset-password", element: <ResetPasswordPage /> },
    {
      element: <RequireAuth />,
      children: [
        {
          element: <AppShell />,
          children: [
            { index: true, element: <DashboardPage /> },
            {
              element: (
                <RequireRoles roles={["SUPER_ADMIN", "CONTENT_EDITOR"]} />
              ),
              children: [
                { path: "packages", element: <PackagesPage /> },
                { path: "packages/new", element: <PackageEditorPage /> },
                { path: "packages/:id/edit", element: <PackageEditorPage /> },
                {
                  path: "packages/:id/preview",
                  element: <PackagePreviewPage />,
                },
                { path: "destinations/*", element: <Navigate to="/packages" replace /> },
                { path: "categories", element: <CategoriesPage /> },
                { path: "categories/new", element: <CategoriesPage /> },
                { path: "categories/:id/edit", element: <CategoriesPage /> },
                { path: "media", element: <MediaLibraryPage /> },
                { path: "media/new", element: <MediaLibraryPage /> },
                { path: "media/:id/edit", element: <MediaLibraryPage /> },
                { path: "gallery", element: <GalleryAlbumsPage /> },
                { path: "gallery/new", element: <GalleryAlbumsPage /> },
                { path: "gallery/:id/edit", element: <GalleryAlbumsPage /> },
                { path: "blog", element: <BlogPage /> },
                { path: "blog/new", element: <BlogPage /> },
                { path: "blog/:id/edit", element: <BlogPage /> },
                { path: "content/pages/*", element: <Navigate to="/" replace /> },
                { path: "content/home/*", element: <Navigate to="/content/settings" replace /> },
                { path: "content/navigation/*", element: <Navigate to="/content/settings" replace /> },
                { path: "content/engagement", element: <EngagementPage /> },
                { path: "content/engagement/faqs/new", element: <EngagementPage /> },
                { path: "content/engagement/faqs/:id/edit", element: <EngagementPage /> },
                { path: "content/engagement/testimonials/new", element: <EngagementPage /> },
                { path: "content/engagement/testimonials/:id/edit", element: <EngagementPage /> },
                { path: "content/settings", element: <SettingsPage /> },
                { path: "content/seo", element: <PageSeoPage /> },
                { path: "content/seo/:key/edit", element: <PageSeoPage /> },
                { path: "content/settings/new", element: <Navigate to="/content/settings" replace /> },
                { path: "content/settings/:key/edit", element: <Navigate to="/content/settings" replace /> },
              ],
            },
            {
              element: <RequireRoles roles={["SUPER_ADMIN", "SALES_AGENT"]} />,
              children: [
                { path: "enquiries", element: <EnquiriesPage /> },
                { path: "enquiries/:id", element: <EnquiryDetailPage /> },
                { path: "notifications", element: <Navigate to="/enquiries" replace /> },
              ],
            },
            {
              element: <RequireRoles roles={["SUPER_ADMIN"]} />,
              children: [
                { path: "users", element: <UsersPage /> },
                { path: "users/new", element: <UsersPage /> },
                { path: "users/:id/edit", element: <UsersPage /> },
              ],
            },
            { path: "profile", element: <Navigate to="/?account=edit" replace /> },
            { path: "audit", element: <Navigate to="/" replace /> },
            { path: "system/environment", element: <Navigate to="/" replace /> },
            { path: "forbidden", element: <ForbiddenPage /> },
            { path: "*", element: <NotFoundPage /> },
          ],
        },
      ],
    },
  ],
  { basename: "/admin" },
);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <ConfirmationProvider>
            <Suspense
              fallback={
                <div className="flex min-h-screen items-center justify-center bg-admin-canvas font-bold text-admin-brand" role="status">
                  Loading admin module…
                </div>
              }
            >
              <RouterProvider router={router} />
            </Suspense>
          </ConfirmationProvider>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
