import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
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
  EnvironmentPage,
  ForbiddenPage,
  NotFoundPage,
  ProfilePage,
} from "./pages/dashboard-pages";
import { AppShell } from "./shell";
import { ToastProvider } from "./ui";
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
const DestinationsPage = lazy(() =>
  import("./pages/catalogue-pages").then((module) => ({
    default: module.DestinationsPage,
  })),
);
const CategoriesPage = lazy(() =>
  import("./pages/catalogue-pages").then((module) => ({
    default: module.CategoriesPage,
  })),
);
const MediaLibraryPage = lazy(() =>
  import("./pages/catalogue-pages").then((module) => ({
    default: module.MediaLibraryPage,
  })),
);
const GalleryAlbumsPage = lazy(() =>
  import("./pages/catalogue-pages").then((module) => ({
    default: module.GalleryAlbumsPage,
  })),
);
const BlogPage = lazy(() =>
  import("./pages/content-pages").then((module) => ({
    default: module.BlogPage,
  })),
);
const ContentPagesPage = lazy(() =>
  import("./pages/content-pages").then((module) => ({
    default: module.ContentPagesPage,
  })),
);
const EngagementPage = lazy(() =>
  import("./pages/content-pages").then((module) => ({
    default: module.EngagementPage,
  })),
);
const HomepageSectionsPage = lazy(() =>
  import("./pages/content-pages").then((module) => ({
    default: module.HomepageSectionsPage,
  })),
);
const NavigationPage = lazy(() =>
  import("./pages/content-pages").then((module) => ({
    default: module.NavigationPage,
  })),
);
const SettingsPage = lazy(() =>
  import("./pages/content-pages").then((module) => ({
    default: module.SettingsPage,
  })),
);
const EnquiriesPage = lazy(() =>
  import("./pages/sales-pages").then((module) => ({
    default: module.EnquiriesPage,
  })),
);
const EnquiryDetailPage = lazy(() =>
  import("./pages/sales-pages").then((module) => ({
    default: module.EnquiryDetailPage,
  })),
);
const NotificationsPage = lazy(() =>
  import("./pages/sales-pages").then((module) => ({
    default: module.NotificationsPage,
  })),
);
const UsersPage = lazy(() =>
  import("./pages/operations-pages").then((module) => ({
    default: module.UsersPage,
  })),
);
const AuditLogsPage = lazy(() =>
  import("./pages/operations-pages").then((module) => ({
    default: module.AuditLogsPage,
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
                { path: "destinations", element: <DestinationsPage /> },
                { path: "destinations/new", element: <DestinationsPage /> },
                { path: "destinations/:id/edit", element: <DestinationsPage /> },
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
                { path: "content/pages", element: <ContentPagesPage /> },
                { path: "content/pages/new", element: <ContentPagesPage /> },
                { path: "content/pages/:id/edit", element: <ContentPagesPage /> },
                { path: "content/home", element: <HomepageSectionsPage /> },
                { path: "content/home/new", element: <HomepageSectionsPage /> },
                { path: "content/home/:id/edit", element: <HomepageSectionsPage /> },
                { path: "content/navigation", element: <NavigationPage /> },
                { path: "content/navigation/new", element: <NavigationPage /> },
                { path: "content/navigation/:key/edit", element: <NavigationPage /> },
                { path: "content/engagement", element: <EngagementPage /> },
                { path: "content/engagement/faqs/new", element: <EngagementPage /> },
                { path: "content/engagement/faqs/:id/edit", element: <EngagementPage /> },
                { path: "content/engagement/testimonials/new", element: <EngagementPage /> },
                { path: "content/engagement/testimonials/:id/edit", element: <EngagementPage /> },
                { path: "content/settings", element: <SettingsPage /> },
                { path: "content/settings/new", element: <SettingsPage /> },
                { path: "content/settings/:key/edit", element: <SettingsPage /> },
              ],
            },
            {
              element: <RequireRoles roles={["SUPER_ADMIN", "SALES_AGENT"]} />,
              children: [
                { path: "enquiries", element: <EnquiriesPage /> },
                { path: "enquiries/:id", element: <EnquiryDetailPage /> },
                { path: "notifications", element: <NotificationsPage /> },
              ],
            },
            {
              element: <RequireRoles roles={["SUPER_ADMIN"]} />,
              children: [
                { path: "users", element: <UsersPage /> },
                { path: "users/new", element: <UsersPage /> },
                { path: "users/:id/edit", element: <UsersPage /> },
                { path: "audit", element: <AuditLogsPage /> },
              ],
            },
            { path: "profile", element: <ProfilePage /> },
            { path: "system/environment", element: <EnvironmentPage /> },
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
          <Suspense
            fallback={
              <div className="flex min-h-screen items-center justify-center bg-admin-canvas font-bold text-admin-brand" role="status">
                Loading admin module…
              </div>
            }
          >
            <RouterProvider router={router} />
          </Suspense>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
