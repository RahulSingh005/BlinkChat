import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Archive,
  Bookmark,
  CheckCheck,
  EllipsisVertical,
  Lock,
  MessageSquarePlus,
  Search,
  Settings,
  SquarePen,
  Star,
  Users,
  X,
} from "lucide-react";
import ConversationItem from "./ConversationItem";
import { listMenuItems } from "./conversationActions";
import PanelHeader from "../layout/PanelHeader";
import Avatar from "../ui/Avatar";
import Menu from "../ui/Menu";
import { ConversationSkeleton } from "../ui/Skeletons";
import { useIsWide } from "../../hooks/useMediaQuery";
import { useNow } from "../../hooks/useNow";
import { api, errorMessage } from "../../lib/api";
import { allDrafts, subscribeDrafts } from "../../lib/drafts";
import { firstName, formatListTime } from "../../lib/format";
import { previewText } from "../../lib/preview";
import { setNavDirection } from "../../lib/transitions";
import { useAuthStore } from "../../store/useAuthStore";
import { conversationTitle, needsReply, peerOf, useChatStore } from "../../store/useChatStore";
import { useLockStore } from "../../store/useLockStore";
import { useUIStore } from "../../store/useUIStore";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "favorites", label: "Favorites" },
  { id: "groups", label: "Groups" },
  { id: "reply", label: "Needs reply" },
];

const sortKey = (c) => new Date(c.lastMessage?.createdAt || c.lastMessageAt || c.createdAt).getTime();

function useDrafts() {
  return useSyncExternalStore(subscribeDrafts, allDrafts, allDrafts);
}

function Highlight({ text, query }) {
  const i = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1;
  if (i === -1) return text;
  const start = Math.max(0, i - 24);
  return (
    <>
      {start > 0 && "…"}
      {text.slice(start, i)}
      <mark className="rounded bg-warning/35 px-0.5 text-inherit">{text.slice(i, i + query.length)}</mark>
      {text.slice(i + query.length)}
    </>
  );
}

const SectionLabel = ({ children }) => <div className="px-2 pb-1 pt-4 text-[0.8125rem] font-semibold text-primary">{children}</div>;

export default function ConversationList() {
  const navigate = useNavigate();
  const { conversationId: activeId } = useParams();
  const wide = useIsWide();
  const me = useAuthStore((s) => s.authUser);
  const presence = useAuthStore((s) => s.presence);
  const conversations = useChatStore((s) => s.conversations);
  const loaded = useChatStore((s) => s.loaded);
  const loadError = useChatStore((s) => s.loadError);
  const typing = useChatStore((s) => s.typing);
  const lockable = useLockStore((s) => Boolean(s.config));
  const drafts = useDrafts();
  useNow(60000); // refresh "Waiting 2h" and times

  const [filter, setFilter] = useState("all");
  const [archived, setArchived] = useState(false);
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState([]);
  const [found, setFound] = useState(null); // message search results
  const [menu, setMenu] = useState(null);
  const [headerMenu, setHeaderMenu] = useState(null);
  const searchRef = useRef(null);

  // Animate rows in only for the first load, not on every update.
  const [animate, setAnimate] = useState(!loaded);
  useEffect(() => {
    if (!loaded) return undefined;
    const t = setTimeout(() => setAnimate(false), 900);
    return () => clearTimeout(t);
  }, [loaded]);

  // Ctrl/Cmd+K focuses search.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const all = useMemo(() => Object.values(conversations), [conversations]);
  const archivedCount = useMemo(() => all.filter((c) => c.me.archived).length, [all]);
  const counts = useMemo(
    () => ({
      unread: all.filter((c) => !c.me.archived && c.me.unreadCount > 0).length,
      reply: all.filter((c) => needsReply(c, me?._id)).length,
      favorites: all.filter((c) => c.me.favorite).length,
    }),
    [all, me?._id]
  );

  const q = query.trim().toLowerCase();
  const list = useMemo(() => {
    let items = all.filter((c) => (q ? true : archived ? c.me.archived : !c.me.archived));
    if (q) {
      items = items.filter((c) => {
        if (conversationTitle(c, me?._id).toLowerCase().includes(q)) return true;
        return c.type === "group" && c.members.some((m) => m.user.fullName?.toLowerCase().includes(q));
      });
    } else if (filter === "unread") items = items.filter((c) => c.me.unreadCount > 0 || c.me.mentionCount > 0);
    else if (filter === "favorites") items = items.filter((c) => c.me.favorite);
    else if (filter === "reply") items = items.filter((c) => needsReply(c, me?._id));
    else if (filter === "groups") items = items.filter((c) => c.type === "group");
    return items.sort((a, b) => {
      const pa = a.me.pinnedAt ? new Date(a.me.pinnedAt).getTime() : 0;
      const pb = b.me.pinnedAt ? new Date(b.me.pinnedAt).getTime() : 0;
      if (pa || pb) return pb - pa;
      return sortKey(b) - sortKey(a);
    });
  }, [all, q, archived, filter, me?._id]);

  // Searching also finds people you haven't chatted with yet, and messages.
  useEffect(() => {
    if (q.length < 2) {
      setPeople([]);
      setFound(null);
      return undefined;
    }
    const controller = new AbortController();
    const t = setTimeout(async () => {
      const term = query.trim();
      const [users, messages] = await Promise.allSettled([
        api.get("/users/search", { params: { q: term, limit: 8 }, signal: controller.signal }),
        api.get("/messages/search", { params: { q: term, limit: 30 }, signal: controller.signal }),
      ]);
      if (controller.signal.aborted) return;
      if (users.status === "fulfilled") {
        const known = new Set(all.filter((c) => c.type === "direct").map((c) => c.peerId));
        setPeople(users.value.data.users.filter((u) => !known.has(u._id)));
      }
      setFound(messages.status === "fulfilled" ? messages.value.data.messages : []);
    }, 280);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [q, query, all]);

  const go = (id, messageId) => {
    if (!wide) setNavDirection("forward");
    navigate(`/chat/${id}${messageId ? `?message=${messageId}` : ""}`, { viewTransition: true });
  };

  const startChat = async (user) => {
    try {
      const conv = await useChatStore.getState().openDirect(user._id);
      setQuery("");
      go(conv._id);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const openSaved = async () => {
    try {
      const conv = await useChatStore.getState().openSelf();
      go(conv._id);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const openMenu = useCallback((conv, anchor) => setMenu({ conv, anchor }), []);

  const markAllRead = () => {
    const chat = useChatStore.getState();
    all.filter((c) => c.me.unreadCount > 0 || c.me.mentionCount > 0).forEach((c) => chat.markRead(c._id));
  };

  const nameIn = (conv, id) => (id === me._id ? "You" : firstName(conv?.members.find((m) => m.user._id === id)?.user.fullName || "Someone"));

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col bg-base-100">
      <PanelHeader
        title={archived ? "Archived" : "Chats"}
        onBack={archived ? () => setArchived(false) : undefined}
        backLabel="Back to chats"
        actions={
          <>
            {!archived && (
              <button type="button" className="icon-btn" onClick={() => useUIStore.getState().open("newChatOpen")} aria-label="New chat" title="New chat">
                <SquarePen className="size-5" />
              </button>
            )}
            <button type="button" className="icon-btn" aria-label="More options" title="Menu" onClick={(e) => setHeaderMenu({ anchor: e.currentTarget })}>
              <EllipsisVertical className="size-5" />
            </button>
          </>
        }
      >
        <div className="px-4 pb-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-base-content/40" />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setQuery("")}
              placeholder="Search or start a new chat"
              className="h-10 w-full rounded-full bg-base-200 pl-10 pr-10 text-[0.9rem] outline-none transition placeholder:text-base-content/45 focus:bg-base-200 focus:ring-2 focus:ring-primary/30"
              aria-label="Search chats, people and messages"
            />
            {query && (
              <button type="button" className="icon-btn icon-btn-sm absolute right-1 top-1/2 -translate-y-1/2" onClick={() => setQuery("")} aria-label="Clear search">
                <X className="size-4" />
              </button>
            )}
          </div>
        </div>
        {!q && !archived && (
          <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-2.5">
            {FILTERS.map((f) => (
              <button key={f.id} type="button" onClick={() => setFilter(f.id)} className={`chip ${filter === f.id ? "chip-active" : ""}`} aria-pressed={filter === f.id}>
                {f.label}
                {["unread", "reply"].includes(f.id) && counts[f.id] > 0 && (
                  <span className={`rounded-full px-1.5 text-[11px] font-bold ${filter === f.id ? "bg-primary-content/25" : "bg-base-content/10"}`}>{counts[f.id]}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </PanelHeader>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-24 md:pb-3">
        {!loaded ? (
          <ConversationSkeleton />
        ) : (
          <div className="px-2">
            {!q && !archived && filter === "all" && archivedCount > 0 && (
              <button type="button" onClick={() => setArchived(true)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition hover:bg-base-content/[0.04]">
                <span className="flex size-12 items-center justify-center text-base-content/60">
                  <Archive className="size-5" />
                </span>
                <span className="flex-1 text-[0.95rem] font-medium">Archived</span>
                <span className="text-[0.8125rem] font-medium text-base-content/50">{archivedCount}</span>
              </button>
            )}

            {q && list.length > 0 && <SectionLabel>Chats</SectionLabel>}
            {list.map((conv, i) => (
              <ConversationItem
                key={conv._id}
                conv={conv}
                meId={me?._id}
                active={conv._id === activeId}
                typing={typing[conv._id]}
                draft={drafts[conv._id]}
                online={conv.type === "direct" && Boolean(presence[peerOf(conv, me?._id)?._id]?.online)}
                narrow={!wide}
                onMenu={openMenu}
                index={i}
                animate={animate}
              />
            ))}

            {q && people.length > 0 && (
              <>
                <SectionLabel>People</SectionLabel>
                {people.map((u) => (
                  <button key={u._id} type="button" onClick={() => startChat(u)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-base-content/[0.04]">
                    <Avatar src={u.profilePic} name={u.fullName} seed={u._id} size={48} online={u.online} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{u.fullName}</span>
                      <span className="block truncate text-[0.8125rem] text-base-content/55">{u.about || u.emailHint}</span>
                    </span>
                    <MessageSquarePlus className="size-5 text-base-content/40" />
                  </button>
                ))}
              </>
            )}

            {q && found?.length > 0 && (
              <>
                <SectionLabel>Messages</SectionLabel>
                {found.map((m) => {
                  const conv = conversations[m.conversation];
                  if (!conv) return null;
                  const title = conversationTitle(conv, me._id);
                  return (
                    <button key={m._id} type="button" onClick={() => go(conv._id, m._id)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-base-content/[0.04]">
                      <Avatar
                        src={conv.type === "group" ? conv.avatar : peerOf(conv, me._id)?.profilePic}
                        name={title}
                        seed={conv.type === "group" ? conv._id : peerOf(conv, me._id)?._id}
                        group={conv.type === "group"}
                        self={conv.type === "self"}
                        size={48}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline gap-2">
                          <span className="min-w-0 flex-1 truncate font-medium">{title}</span>
                          <span className="shrink-0 text-xs text-base-content/45">{formatListTime(m.createdAt)}</span>
                        </span>
                        <span className="line-clamp-2 text-[0.8125rem] text-base-content/60">
                          {conv.type === "group" && <span className="text-base-content/75">{nameIn(conv, m.sender)}: </span>}
                          <Highlight text={m.text || previewText(m, { conv, meId: me._id })} query={query.trim()} />
                        </span>
                      </span>
                    </button>
                  );
                })}
              </>
            )}

            {list.length === 0 && (!q || (people.length === 0 && !found?.length)) && (
              <EmptyList filter={filter} query={q} archived={archived} error={loadError} empty={all.length === 0} searching={q.length >= 2 && found === null} />
            )}
          </div>
        )}
      </div>

      {/* Phones: thumb-reachable new chat button */}
      {!wide && !archived && (
        <button
          type="button"
          onClick={() => useUIStore.getState().open("newChatOpen")}
          className="anim-pop absolute bottom-4 right-4 z-10 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-content shadow-float transition active:scale-95 md:hidden"
          aria-label="New chat"
        >
          <MessageSquarePlus className="size-6" />
        </button>
      )}

      <Menu open={Boolean(menu)} anchor={menu?.anchor} onClose={() => setMenu(null)} items={menu ? listMenuItems(menu.conv, { onDeleted: () => menu.conv._id === activeId && navigate("/chat") }) : []} title={menu ? conversationTitle(menu.conv, me?._id) : ""} />
      <Menu
        open={Boolean(headerMenu)}
        anchor={headerMenu?.anchor}
        onClose={() => setHeaderMenu(null)}
        items={[
          { key: "group", label: "New group", icon: Users, onSelect: () => useUIStore.getState().open("newGroupOpen") },
          { key: "saved", label: "Saved messages", icon: Bookmark, onSelect: openSaved },
          { key: "starred", label: "Starred messages", icon: Star, onSelect: () => navigate("/starred", { viewTransition: true }) },
          { key: "archived", label: `Archived chats${archivedCount ? ` (${archivedCount})` : ""}`, icon: Archive, onSelect: () => setArchived(true) },
          { key: "readall", label: "Mark all as read", icon: CheckCheck, disabled: !counts.unread, onSelect: markAllRead },
          "divider",
          lockable && { key: "lock", label: "Lock app now", icon: Lock, onSelect: () => useLockStore.getState().lockNow() },
          { key: "settings", label: "Settings", icon: Settings, onSelect: () => navigate("/settings", { viewTransition: true }) },
        ]}
      />
    </div>
  );
}

function EmptyList({ filter, query, archived, error, empty, searching }) {
  let title = "No chats yet";
  let body = "Start a conversation with anyone on BlinkChat.";
  if (error) {
    title = "Couldn't load chats";
    body = error;
  } else if (searching) {
    title = "Searching…";
    body = "";
  } else if (query) {
    title = "No results";
    body = "Try a different name or word, or search by email.";
  } else if (archived) {
    title = "No archived chats";
    body = "Archive chats to keep your list tidy. They come back when new messages arrive.";
  } else if (!empty && filter === "unread") {
    title = "You're all caught up";
    body = "No unread messages.";
  } else if (!empty && filter === "favorites") {
    title = "No favorites yet";
    body = "Long-press (or right-click) a chat and choose “Add to favorites” to find it here quickly.";
  } else if (!empty && filter === "reply") {
    title = "Nothing waiting on you";
    body = "Chats where someone is waiting for your reply will show up here.";
  } else if (!empty && filter === "groups") {
    title = "No groups yet";
    body = "Create a group to chat with several people at once.";
  }
  return (
    <div className="anim-fade mx-auto flex max-w-xs flex-col items-center px-6 py-14 text-center">
      <h2 className="font-semibold">{title}</h2>
      {body && <p className="mt-1 text-sm text-base-content/55">{body}</p>}
      {error ? (
        <button type="button" className="btn btn-sm mt-4 rounded-xl" onClick={() => useChatStore.getState().fetchConversations()}>
          Try again
        </button>
      ) : (
        (empty || filter === "groups") &&
        !query && (
          <button
            type="button"
            className="btn btn-primary btn-sm mt-4 rounded-xl"
            onClick={() => useUIStore.getState().open(filter === "groups" ? "newGroupOpen" : "newChatOpen")}
          >
            {filter === "groups" ? "New group" : "Start a chat"}
          </button>
        )
      )}
    </div>
  );
}
