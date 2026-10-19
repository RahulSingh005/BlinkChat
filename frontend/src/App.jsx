import { lazy } from "react";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";
import AppShell from "./components/layout/AppShell";
import { GuestOnly, RequireAuth } from "./components/layout/Guards";
import Root from "./components/layout/Root";
import RouteError from "./components/layout/RouteError";
import ChatPage from "./pages/ChatPage";
import { setNavigate } from "./lib/navigation";

const LandingPage = lazy(() => import("./pages/LandingPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const SignUpPage = lazy(() => import("./pages/SignUpPage"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const RemindersPage = lazy(() => import("./pages/RemindersPage"));
const UpdatesPage = lazy(() => import("./pages/UpdatesPage"));
const CallsPage = lazy(() => import("./pages/CallsPage"));
const StarredPage = lazy(() => import("./pages/StarredPage"));
const JoinPage = lazy(() => import("./pages/JoinPage"));
const UserLinkPage = lazy(() => import("./pages/UserLinkPage"));
const LegalPage = lazy(() => import("./pages/LegalPage"));

const router = createBrowserRouter([
  {
    element: <Root />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <GuestOnly landing><LandingPage /></GuestOnly> },
      { path: "login", element: <GuestOnly><LoginPage /></GuestOnly> },
      { path: "signup", element: <GuestOnly><SignUpPage /></GuestOnly> },
      { path: "forgot-password", element: <GuestOnly><ForgotPasswordPage /></GuestOnly> },
      { path: "privacy", element: <LegalPage kind="privacy" /> },
      { path: "terms", element: <LegalPage kind="terms" /> },
      {
        element: (
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        ),
        children: [
          { path: "chat", element: <ChatPage /> },
          { path: "chat/:conversationId", element: <ChatPage /> },
          { path: "updates", element: <UpdatesPage /> },
          { path: "calls", element: <CallsPage /> },
          { path: "reminders", element: <RemindersPage /> },
          { path: "starred", element: <StarredPage /> },
          { path: "settings", element: <SettingsPage /> },
          { path: "settings/:section", element: <SettingsPage /> },
          { path: "profile", element: <Navigate to="/settings/profile" replace /> },
          { path: "join/:code", element: <JoinPage /> },
          { path: "u/:userId", element: <UserLinkPage /> },
        ],
      },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);

setNavigate((to, options) => router.navigate(to, options));

export default function App() {
  return <RouterProvider router={router} />;
}
