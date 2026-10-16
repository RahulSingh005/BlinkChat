import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../../store/useAuthStore";
import BootScreen from "./BootScreen";

export function RequireAuth({ children }) {
  const status = useAuthStore((s) => s.status);
  const location = useLocation();
  if (status === "checking") return <BootScreen />;
  if (status !== "authenticated") {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return children;
}

export function GuestOnly({ children, landing = false }) {
  const status = useAuthStore((s) => s.status);
  const location = useLocation();
  if (status === "checking") return <BootScreen />;
  if (status === "authenticated") {
    const from = location.state?.from;
    return <Navigate to={!landing && from && from.startsWith("/") ? from : "/chat"} replace />;
  }
  return children;
}
