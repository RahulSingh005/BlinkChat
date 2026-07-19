import Navbar from "./components/Navbar";

import HomePage from "./pages/HomePage";
import SignUpPage from "./pages/SignUpPage";
import LoginPage from "./pages/LoginPage";
import SettingsPage from "./pages/SettingsPage";
import ProfilePage from "./pages/ProfilePage";

import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./store/useAuthStore";
import { useThemeStore } from "./store/useThemeStore";
import { useChatStore } from "./store/useChatStore";
import { useEffect } from "react";

import { Loader } from "lucide-react";
import { Toaster } from "react-hot-toast";

const App = () => {
  const { authUser, checkAuth, isCheckingAuth, socket } = useAuthStore();
  const { theme, initTheme } = useThemeStore();
  const setupGlobalListeners = useChatStore((s) => s.setupGlobalListeners);
  const teardownGlobalListeners = useChatStore((s) => s.teardownGlobalListeners);

  useEffect(() => {
    initTheme();
    checkAuth();
  }, [checkAuth, initTheme]);

  useEffect(() => {
    if (!authUser || !socket) return;

    const onConnect = () => setupGlobalListeners();

    socket.on("connect", onConnect);
    if (socket.connected) onConnect();

    return () => {
      socket.off("connect", onConnect);
      teardownGlobalListeners();
    };
  }, [authUser, socket, setupGlobalListeners, teardownGlobalListeners]);

  if (isCheckingAuth && !authUser)
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 bg-mesh">
        <div className="size-14 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Loader className="size-7 animate-spin text-primary" />
        </div>
        <p className="text-sm text-base-content/50 font-medium">Loading BlinkChat...</p>
      </div>
    );

  return (
    <div data-theme={theme} className="min-h-screen">
      <Navbar />

      <Routes>
        <Route path="/" element={authUser ? <HomePage /> : <Navigate to="/login" />} />
        <Route path="/signup" element={!authUser ? <SignUpPage /> : <Navigate to="/" />} />
        <Route path="/login" element={!authUser ? <LoginPage /> : <Navigate to="/" />} />
        <Route path="/settings" element={authUser ? <SettingsPage /> : <Navigate to="/login" />} />
        <Route path="/profile" element={authUser ? <ProfilePage /> : <Navigate to="/login" />} />
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
