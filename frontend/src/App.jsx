import DashboardLayout from "./components/DashboardLayout";

import LandingPage from "./pages/LandingPage";
import HomePage from "./pages/HomePage";
import SignUpPage from "./pages/SignUpPage";
import LoginPage from "./pages/LoginPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import SettingsPage from "./pages/SettingsPage";
import ProfilePage from "./pages/ProfilePage";

import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./store/useAuthStore";
import { useThemeStore } from "./store/useThemeStore";
import { useChatStore } from "./store/useChatStore";
import { useCallStore } from "./store/useCallStore";
import { useEffect } from "react";

import { Loader } from "lucide-react";
import { Toaster } from "react-hot-toast";
import CallModal from "./components/CallModal";

const App = () => {
  const { authUser, checkAuth, isCheckingAuth, socket } = useAuthStore();
  const { theme, fontSize, initTheme } = useThemeStore();
  const setupGlobalListeners = useChatStore((s) => s.setupGlobalListeners);
  const teardownGlobalListeners = useChatStore((s) => s.teardownGlobalListeners);
  const setupCallListeners = useCallStore((s) => s.setupCallListeners);
  const teardownCallListeners = useCallStore((s) => s.teardownCallListeners);

  useEffect(() => {
    initTheme();
    checkAuth();
  }, [checkAuth, initTheme]);

  useEffect(() => {
    if (!authUser || !socket) return;

    const onConnect = () => {
      setupGlobalListeners();
      setupCallListeners();
    };

    socket.on("connect", onConnect);
    if (socket.connected) onConnect();

    return () => {
      socket.off("connect", onConnect);
      teardownGlobalListeners();
      teardownCallListeners();
    };
  }, [authUser, socket, setupGlobalListeners, teardownGlobalListeners, setupCallListeners, teardownCallListeners]);

  if (isCheckingAuth && !authUser)
    return (
      <div data-theme={theme} className="flex flex-col items-center justify-center h-dvh gap-4 bg-mesh">
        <div className="size-14 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Loader className="size-7 animate-spin text-primary" />
        </div>
        <p className="text-sm text-base-content/50 font-medium">Loading BlinkChat...</p>
      </div>
    );

  return (
    <div data-theme={theme} data-font-size={fontSize} className="min-h-screen">
      <CallModal />
      <Routes>
        <Route path="/" element={authUser ? <Navigate to="/chat" /> : <LandingPage />} />
        <Route path="/signup" element={!authUser ? <SignUpPage /> : <Navigate to="/chat" />} />
        <Route path="/login" element={!authUser ? <LoginPage /> : <Navigate to="/chat" />} />
        <Route
          path="/forgot-password"
          element={!authUser ? <ForgotPasswordPage /> : <Navigate to="/chat" />}
        />
        <Route
          path="/chat"
          element={
            authUser ? (
              <DashboardLayout>
                <HomePage />
              </DashboardLayout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/settings"
          element={
            authUser ? (
              <DashboardLayout scroll>
                <SettingsPage />
              </DashboardLayout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/profile"
          element={
            authUser ? (
              <DashboardLayout scroll>
                <ProfilePage />
              </DashboardLayout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route path="*" element={<Navigate to={authUser ? "/chat" : "/"} />} />
      </Routes>

      <Toaster
        position="top-right"
        toastOptions={{
          className: "text-sm font-medium",
          duration: 3000,
        }}
      />
    </div>
  );
};
export default App;
