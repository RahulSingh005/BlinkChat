import { useEffect, useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import ChatView from "../components/chat/ChatView";
import ConversationList from "../components/chat/ConversationList";
import EmptyChat from "../components/chat/EmptyChat";
import InfoPanel from "../components/chat/InfoPanel";
import SplitView from "../components/layout/SplitView";
import { useIsDesktop } from "../hooks/useMediaQuery";
import { useChatStore } from "../store/useChatStore";
import { useUIStore } from "../store/useUIStore";

/**
 * Phones: one pane at a time (list ⇄ chat, with native-like slide
 * transitions and a working back button). Larger screens: list + chat side
 * by side, and the details panel docked on wide desktops.
 */
export default function ChatPage() {
  const { conversationId } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const desktop = useIsDesktop();
  const loaded = useChatStore((s) => s.loaded);
  const exists = useChatStore((s) => Boolean(conversationId && s.conversations[conversationId]));
  const infoOpen = useUIStore((s) => s.infoOpen);
  const opened = useRef(new Set());

  useEffect(() => {
    if (!conversationId || !loaded) return undefined;
    if (!exists) {
      // We were in this chat and it went away (deleted / left): just leave.
      if (opened.current.has(conversationId)) {
        navigate("/chat", { replace: true });
        return undefined;
      }
      let cancelled = false;
      useChatStore
        .getState()
        .fetchConversation(conversationId)
        .then((conv) => {
          if (!conv && !cancelled) {
            toast.error("That chat isn't available.");
            navigate("/chat", { replace: true });
          }
        });
      return () => {
        cancelled = true;
      };
    }
    opened.current.add(conversationId);
    useChatStore.getState().openConversation(conversationId);
    return () => useChatStore.getState().closeConversation();
  }, [conversationId, loaded, exists, navigate]);

  // Close per-chat panels when switching chats.
  useEffect(() => {
    useUIStore.setState({ searchOpen: false });
  }, [conversationId]);

  // Deep links like /chat/:id?message=:messageId (reminders, notifications, search).
  useEffect(() => {
    const messageId = params.get("message");
    if (!messageId || !conversationId || !exists) return;
    useChatStore.getState().jumpToMessage(conversationId, messageId);
    params.delete("message");
    setParams(params, { replace: true });
  }, [params, setParams, conversationId, exists]);

  return (
    <SplitView
      showDetail={Boolean(conversationId)}
      list={<ConversationList />}
      detail={conversationId ? <ChatView key={conversationId} conversationId={conversationId} /> : <EmptyChat />}
      aside={
        desktop && infoOpen && conversationId && exists ? (
          <aside className="anim-drawer flex w-[min(380px,28vw)] shrink-0 border-l border-base-300/70 bg-base-100">
            <InfoPanel conversationId={conversationId} docked />
          </aside>
        ) : null
      }
    />
  );
}
