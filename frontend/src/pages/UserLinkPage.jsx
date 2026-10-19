import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import Spinner from "../components/ui/Spinner";
import { errorMessage } from "../lib/api";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";

/** /u/:userId (profile links and QR codes) opens a chat with that person. */
export default function UserLinkPage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const me = useAuthStore((s) => s.authUser);

  useEffect(() => {
    if (!/^[a-f\d]{24}$/i.test(userId || "")) {
      toast.error("That profile link isn't valid");
      navigate("/chat", { replace: true });
      return;
    }
    if (userId === me._id) {
      navigate("/settings/profile", { replace: true });
      return;
    }
    let cancelled = false;
    useChatStore
      .getState()
      .openDirect(userId)
      .then((conv) => !cancelled && navigate(`/chat/${conv._id}`, { replace: true }))
      .catch((err) => {
        if (cancelled) return;
        toast.error(errorMessage(err, "Couldn't open that chat"));
        navigate("/chat", { replace: true });
      });
    return () => {
      cancelled = true;
    };
  }, [userId, me._id, navigate]);

  return (
    <div className="flex flex-1 items-center justify-center bg-base-200">
      <Spinner className="size-7 text-base-content/40" />
    </div>
  );
}
