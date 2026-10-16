import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { Archive, ArrowLeft, CheckCheck, EllipsisVertical, MessageSquarePlus, Search, SquarePen, Users, X } from "lucide-react";
import ConversationItem from "./ConversationItem";
import { listMenuItems } from "./conversationActions";
import Avatar from "../ui/Avatar";
import Menu from "../ui/Menu";
import { ConversationSkeleton } from "../ui/Skeletons";
import { useIsWide } from "../../hooks/useMediaQuery";
import { useNow } from "../../hooks/useNow";
import { api, errorMessage } from "../../lib/api";
import { allDrafts, subscribeDrafts } from "../../lib/drafts";
import { setNavDirection } from "../../lib/transitions";
import { useAuthStore } from "../../store/useAuthStore";
import { conversationTitle, needsReply, peerOf, useChatStore } from "../../store/useChatStore";
import { useUIStore } from "../../store/useUIStore";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "reply", label: "Needs reply" },
  { id: "groups", label: "Groups" },
];

const sortKey = (c) => new Date(c.lastMessage?.createdAt || c.lastMessageAt || c.createdAt).getTime();

function useDrafts() {
  return useSyncExternalStore(subscribeDrafts, allDrafts, allDrafts);
}

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
  const drafts = useDrafts();
  useNow(60000); // refresh "Waiting 2h" and times

  const [filter, setFilter] = useState("all");
  const [archived, setArchived] = useState(false);
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState([]);
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
    } else if (filter === "unread") items = items.filter((c) => c.me.unreadCount > 0);
    else if (filter === "reply") items = items.filter((c) => needsReply(c, me?._id));
    else if (filter === "groups") items = items.filter((c) => c.type === "group");
    return items.sort((a, b) => {
      const pa = a.me.pinnedAt ? new Date(a.me.pinnedAt).getTime() : 0;
      const pb = b.me.pinnedAt ? new Date(b.me.pinnedAt).getTime() : 0;
      if (pa || pb) return pb - pa;
      return sortKey(b) - sortKey(a);
    });
  }, [all, q, archived, filter, me?._id]);

  // Searching also finds people you haven't chatted with yet.
  useEffect(() => {
    if (q.length < 2) {
      setPeople([]);
      return undefined;
    }
    const controller = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await api.get("/users/search", { params: { q: query.trim(), limit: 8 }, signal: controller.signal });
        const known = new Set(all.filter((c) => c.type === "direct").map((c) => c.peerId));
        setPeople(res.data.users.filter((u) => !known.has(u._id)));
      } catch {
        // ignore aborted / failed searches
      }
    }, 250);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [q, query, all]);

  const startChat = async (user) => {
    try {
      const conv = await useChatStore.getState().openDirect(user._id);
      setQuery("");
      if (!wide) setNavDirection("forward");
      navigate(`/chat/${conv._id}`, { viewTransition: true });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const openMenu = useCallback((conv, anchor) => setMenu({ conv, anchor }), []);

  const markAllRead = () => {
    const chat = useChatStore.getState();
    all.filter((c) => c.me.unreadCount > 0).forEach((c) => chat.markRead(c._id));
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-base-100">
      <header className="safe-top shrink-0 px-4 pb-2 pt-3">
        <div className="flex h-10 items-center gap-2">
          {archived ? (
            <>
              <button type="button" className="icon-btn -ml-2" onClick={() => setArchived(false)} aria-label="Back to chats">
                <ArrowLeft className="size-5" />
              </button>
              <h1 className="text-xl font-bold tracking-tight">Archived</h1>
            </>
          ) : (
            <h1 className="text-[1.6rem] font-bold tracking-tight">Chats</h1>
          )}
          <div className="ml-auto flex items-center">
            <button type="button" className="icon-btn" onClick={() => useUIStore.getState().open("newChatOpen")} aria-label="New chat" title="New chat">
              <SquarePen className="size-5" />
            </button>
            <button
              type="button"
              className="icon-btn -mr-2"
              aria-label="More options"
              onClick={(e) => setHeaderMenu({ anchor: e.currentTarget })}
            >
              <EllipsisVertical className="size-5" />
            </button>
          </div>
        </div>

        <div className="relative mt-2">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-base-content/40" />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setQuery("")}
            placeholder="Search chats or people"
            className="h-10 w-full rounded-xl bg-base-200/80 pl-10 pr-9 text-[0.9rem] outline-none transition placeholder:text-base-content/40 focus:bg-base-200 focus:ring-2 focus:ring-primary/25"
            aria-label="Search chats or people"
          />
          {query && (
            <button type="button" className="icon-btn icon-btn-sm absolute right-1 top-1/2 -translate-y-1/2" onClick={() => setQuery("")} aria-label="Clear search">
              <X className="size-4" />
            </button>
          )}
        </div>

        {!q && !archived && (
          <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
            {FILTERS.map((f) => (
              <button key={f.id} type="button" onClick={() => setFilter(f.id)} className={`chip ${filter === f.id ? "chip-active" : ""}`} aria-pressed={filter === f.id}>
                {f.label}
                {f.id !== "all" && f.id !== "groups" && counts[f.id] > 0 && (
                  <span className={`rounded-full px-1.5 text-[11px] font-bold ${filter === f.id ? "bg-white/25" : "bg-base-content/10"}`}>{counts[f.id]}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-24 md:pb-4">
        {!loaded ? (
          <ConversationSkeleton />
        ) : (
          <div className="px-2">
            {!q && !archived && filter === "all" && archivedCount > 0 && (
              <button type="button" onClick={() => setArchived(true)} className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition hover:bg-base-content/[0.04]">
                <span className="flex size-[50px] items-center justify-center rounded-full bg-base-200 text-base-content/60">
                  <Archive className="size-5" />
                </span>
                <span className="flex-1 text-[0.95rem] font-medium">Archived</span>
                <span className="mr-1 text-sm text-base-content/50">{archivedCount}</span>
              </button>
            )}

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
              <div className="mt-3">
                <div className="section-title px-3">People</div>
                {people.map((u) => (
                  <button key={u._id} type="button" onClick={() => startChat(u)} className="flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition hover:bg-base-content/[0.04]">
                    <Avatar src={u.profilePic} name={u.fullName} seed={u._id} size={44} online={u.online} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{u.fullName}</span>
                      <span className="block truncate text-[0.8125rem] text-base-content/55">{u.about || u.emailHint}</span>
                    </span>
                    <MessageSquarePlus className="size-5 text-base-content/40" />
                  </button>
                ))}
              </div>
            )}

            {list.length === 0 && (!q || people.length === 0) && (
              <EmptyList filter={filter} query={q} archived={archived} error={loadError} empty={all.length === 0} />
            )}
          </div>
        )}
      </div>

      {/* Phones: thumb-reachable new chat button */}
      {!wide && (
        <button
          type="button"
          onClick={() => useUIStore.getState().open("newChatOpen")}
          className="absolute bottom-4 right-4 z-10 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-content shadow-float transition active:scale-95 md:hidden"
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
          { key: "archived", label: `Archived chats${archivedCount ? ` (${archivedCount})` : ""}`, icon: Archive, onSelect: () => setArchived(true) },
          { key: "readall", label: "Mark all as read", icon: CheckCheck, disabled: !counts.unread, onSelect: markAllRead },
        ]}
      />
    </div>
  );
}

function EmptyList({ filter, query, archived, error, empty }) {
  let title = "No chats yet";
  let body = "Start a conversation with anyone on BlinkChat.";
  if (error) {
    title = "Couldn't load chats";
    body = error;
  } else if (query) {
    title = "No results";
    body = "Try a different name, or search by email.";
  } else if (archived) {
    title = "No archived chats";
    body = "Archive chats to keep your list tidy. They come back when new messages arrive.";
  } else if (!empty && filter === "unread") {
    title = "You're all caught up";
    body = "No unread messages.";
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
      <p className="mt-1 text-sm text-base-content/55">{body}</p>
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
