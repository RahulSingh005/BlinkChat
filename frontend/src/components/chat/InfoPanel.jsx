import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  AudioLines,
  Ban,
  Bell,
  BellOff,
  Camera,
  Clock3,
  Crown,
  Eraser,
  EllipsisVertical,
  FileText,
  Image as ImageIcon,
  Languages,
  LogOut,
  MessageCircle,
  Pencil,
  Phone,
  Search,
  ShieldCheck,
  Timer,
  Trash2,
  UserMinus,
  UserPlus,
  Video,
  X,
} from "lucide-react";
import Avatar from "../ui/Avatar";
import Menu from "../ui/Menu";
import Sheet from "../ui/Sheet";
import Spinner from "../ui/Spinner";
import FileCard from "./FileCard";
import PeoplePicker from "./PeoplePicker";
import VoicePlayer from "./VoicePlayer";
import { confirmBlock, confirmClear, confirmDelete, muteItems } from "./conversationActions";
import { useIsWide } from "../../hooks/useMediaQuery";
import { useNow } from "../../hooks/useNow";
import { api, errorMessage, imageVariant, mediaUrl } from "../../lib/api";
import { firstName, formatLastSeen, formatLongDate, formatUntil, plural } from "../../lib/format";
import { cropSquare } from "../../lib/media";
import { disappearingLabel } from "../../lib/preview";
import { isValidTz, timeIn, zoneCity, zoneDiffLabel } from "../../lib/time";
import { setNavDirection } from "../../lib/transitions";
import { uploadFile } from "../../lib/upload";
import { useAuthStore } from "../../store/useAuthStore";
import { useCallStore } from "../../store/useCallStore";
import { conversationTitle, isMuted, peerOf, useChatStore } from "../../store/useChatStore";
import { useAiEnabled } from "../../store/useConfigStore";
import { useSettingsStore } from "../../store/useSettingsStore";
import { useUIStore } from "../../store/useUIStore";

const TIMERS = [0, 86400, 604800, 7776000];

function Section({ title, children, action }) {
  return (
    <section className="border-t border-base-300/60 px-5 py-4">
      {(title || action) && (
        <div className="mb-2 flex items-center justify-between">
          {title && <h4 className="text-xs font-semibold uppercase tracking-wider text-base-content/50">{title}</h4>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

function Row({ icon: Icon, label, value, onClick, danger, children }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag type={onClick ? "button" : undefined} onClick={onClick} className={`-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-xl px-2 py-2.5 text-left ${onClick ? "transition hover:bg-base-content/[0.05]" : ""} ${danger ? "text-error" : ""}`}>
      <Icon className={`size-5 shrink-0 ${danger ? "" : "text-base-content/55"}`} />
      <span className="min-w-0 flex-1">
        <span className="block text-[0.92rem]">{label}</span>
        {value && <span className="block truncate text-xs text-base-content/55">{value}</span>}
      </span>
      {children}
    </Tag>
  );
}

function SharedMedia({ conv }) {
  const [tab, setTab] = useState("media");
  const [items, setItems] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    api
      .get(`/conversations/${conv._id}/media`, { params: { kind: tab, limit: 30 } })
      .then((res) => !cancelled && setItems(res.data.messages))
      .catch(() => !cancelled && setItems([]));
    return () => {
      cancelled = true;
    };
  }, [conv._id, tab]);

  const media = useMemo(
    () => (items || []).flatMap((m) => m.attachments.filter((a) => (tab === "media" ? a.kind === "image" || a.kind === "video" : tab === "files" ? a.kind === "file" : a.kind === "audio")).map((a) => ({ ...a, at: m.createdAt, sender: m.sender }))),
    [items, tab]
  );

  return (
    <Section title="Shared">
      <div className="mb-3 flex gap-1.5">
        {[
          ["media", "Media", ImageIcon],
          ["files", "Files", FileText],
          ["audio", "Voice", AudioLines],
        ].map(([id, label, Icon]) => (
          <button key={id} type="button" onClick={() => setTab(id)} className={`chip ${tab === id ? "chip-active" : ""}`}>
            <Icon className="size-3.5" /> {label}
          </button>
        ))}
      </div>
      {items === null ? (
        <div className="flex justify-center py-6">
          <Spinner className="size-5 text-base-content/40" />
        </div>
      ) : media.length === 0 ? (
        <p className="py-4 text-center text-sm text-base-content/45">Nothing shared yet</p>
      ) : tab === "media" ? (
        <div className="grid grid-cols-3 gap-1">
          {media.slice(0, 30).map((a, i) => (
            <button
              key={`${a.url}-${i}`}
              type="button"
              onClick={() => useUIStore.getState().open("lightbox", { items: media.map((x) => ({ ...x, sender: "" })), index: i })}
              className="aspect-square overflow-hidden rounded-lg bg-base-200"
            >
              {a.kind === "video" ? (
                <video src={mediaUrl(a.url)} preload="metadata" muted className="size-full object-cover" />
              ) : (
                <img src={imageVariant(a.url, 240)} alt="" loading="lazy" className="size-full object-cover transition hover:scale-105" />
              )}
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {media.map((a, i) => (tab === "files" ? <FileCard key={`${a.url}-${i}`} att={a} /> : <VoicePlayer key={`${a.url}-${i}`} att={a} />))}
        </div>
      )}
    </Section>
  );
}

function MemberRow({ member, conv, me, onMessage }) {
  const [menu, setMenu] = useState(null);
  const online = useAuthStore((s) => Boolean(s.presence[member.user._id]?.online));
  const isMe = member.user._id === me._id;
  const iAmAdmin = conv.me.role === "admin";
  const chat = useChatStore.getState();

  const run = async (fn, ok) => {
    try {
      await fn();
      if (ok) toast.success(ok);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <li className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-1.5">
      <Avatar src={member.user.profilePic} name={member.user.fullName} seed={member.user._id} size={40} online={online} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-[0.92rem] font-medium">
          <span className="truncate">{isMe ? "You" : member.user.fullName}</span>
          {member.role === "admin" && <span className="rounded bg-primary/10 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-primary">Admin</span>}
        </span>
        <span className="block truncate text-xs text-base-content/55">{member.user.status?.text || member.user.about}</span>
      </span>
      {!isMe && !member.user.deleted && (
        <button type="button" className="icon-btn icon-btn-sm" onClick={(e) => setMenu({ anchor: e.currentTarget })} aria-label={`Options for ${member.user.fullName}`}>
          <EllipsisVertical className="size-4" />
        </button>
      )}
      <Menu
        open={Boolean(menu)}
        anchor={menu?.anchor}
        onClose={() => setMenu(null)}
        title={member.user.fullName}
        items={[
          { key: "msg", label: `Message ${firstName(member.user.fullName)}`, icon: MessageCircle, onSelect: () => onMessage(member.user) },
          iAmAdmin && {
            key: "role",
            label: member.role === "admin" ? "Dismiss as admin" : "Make group admin",
            icon: Crown,
            onSelect: () => run(() => chat.setMemberRole(conv._id, member.user._id, member.role === "admin" ? "member" : "admin")),
          },
          iAmAdmin && {
            key: "remove",
            label: "Remove from group",
            icon: UserMinus,
            danger: true,
            onSelect: () => run(() => chat.removeMember(conv._id, member.user._id), "Removed"),
          },
        ]}
      />
    </li>
  );
}

export default function InfoPanel({ conversationId, docked = false }) {
  const conv = useChatStore((s) => s.conversations[conversationId]);
  const me = useAuthStore((s) => s.authUser);
  const navigate = useNavigate();
  const wide = useIsWide();
  const ai = useAiEnabled();
  const autoTranslate = useSettingsStore((s) => Boolean(s.autoTranslate[conversationId]));
  const peer = conv ? peerOf(conv, me._id) : null;
  const presence = useAuthStore((s) => (peer ? s.presence[peer._id] : null));
  const [details, setDetails] = useState(null);
  const [muteMenu, setMuteMenu] = useState(null);
  const [timerMenu, setTimerMenu] = useState(null);
  const [adding, setAdding] = useState(false);
  const [toAdd, setToAdd] = useState([]);
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const photoRef = useRef(null);
  useNow(30000);

  useEffect(() => {
    if (!peer?._id || peer.deleted) return;
    api
      .get(`/users/${peer._id}`)
      .then((res) => setDetails(res.data))
      .catch(() => {});
  }, [peer?._id, peer?.deleted]);

  if (!conv) return null;
  const close = () => useUIStore.getState().close("infoOpen");
  const group = conv.type === "group";
  const title = conversationTitle(conv, me._id);
  const admin = group && conv.me.role === "admin";
  const muted = isMuted(conv);

  const goToUser = async (user) => {
    try {
      const c = await useChatStore.getState().openDirect(user._id);
      close();
      if (!wide) setNavDirection("forward");
      navigate(`/chat/${c._id}`, { viewTransition: true });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const changePhoto = async (file) => {
    setBusy(true);
    try {
      const cropped = await cropSquare(file);
      const att = await uploadFile(cropped, { purpose: "group" });
      await useChatStore.getState().updateGroup(conv._id, { avatar: att.url });
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't update the photo"));
    } finally {
      setBusy(false);
    }
  };

  const saveName = async () => {
    if (!name.trim() || name.trim() === conv.name) return setEditingName(false);
    try {
      await useChatStore.getState().updateGroup(conv._id, { name: name.trim() });
      setEditingName(false);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const addMembers = async () => {
    setBusy(true);
    try {
      await useChatStore.getState().addMembers(conv._id, toAdd.map((u) => u._id));
      toast.success(toAdd.length > 1 ? `Added ${toAdd.length} people` : "Added");
      setAdding(false);
      setToAdd([]);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const call = (type) => {
    if (!peer || conv.blocked) return;
    useCallStore.getState().startCall(conv, peer, type);
  };

  let subtitle = "";
  if (group) subtitle = `Group · ${plural(conv.members.length, "member")}`;
  else if (peer?.deleted) subtitle = "Deleted account";
  else if (presence?.online) subtitle = "online";
  else if (peer?.presenceVisible) subtitle = formatLastSeen(presence?.lastSeen || peer?.lastSeen);

  const sortedMembers = [...conv.members].sort((a, b) => (a.user._id === me._id ? -1 : b.user._id === me._id ? 1 : (a.role === "admin" ? -1 : 0) - (b.role === "admin" ? -1 : 0) || a.user.fullName.localeCompare(b.user.fullName)));

  return (
    <div className="flex h-full w-full flex-col bg-base-100">
      <header className="safe-top flex h-16 shrink-0 items-center gap-2 border-b border-base-300/60 px-3">
        <button type="button" className="icon-btn" onClick={close} aria-label="Close details">
          <X className="size-5" />
        </button>
        <h2 className="font-semibold">{group ? "Group info" : "Contact info"}</h2>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <section className="flex flex-col items-center px-6 pb-5 pt-6 text-center">
          <div className="relative">
            <Avatar src={group ? conv.avatar : peer?.profilePic} name={title} seed={group ? conv._id : peer?._id} group={group} size={112} />
            {admin && (
              <>
                <button
                  type="button"
                  onClick={() => photoRef.current?.click()}
                  className="absolute bottom-0 right-0 flex size-9 items-center justify-center rounded-full bg-primary text-primary-content shadow-soft ring-4 ring-base-100 transition active:scale-95"
                  aria-label="Change group photo"
                >
                  {busy ? <Spinner className="size-4" /> : <Camera className="size-4" />}
                </button>
                <input
                  ref={photoRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) changePhoto(f);
                  }}
                />
              </>
            )}
          </div>
          {editingName ? (
            <div className="mt-3 flex w-full gap-2">
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className="field h-10" autoFocus onKeyDown={(e) => e.key === "Enter" && saveName()} />
              <button type="button" className="btn btn-primary btn-sm h-10 rounded-xl" onClick={saveName}>
                Save
              </button>
            </div>
          ) : (
            <h3 className="mt-3 flex items-center gap-1.5 text-xl font-semibold tracking-tight">
              {title}
              {admin && (
                <button
                  type="button"
                  className="icon-btn icon-btn-sm size-7"
                  onClick={() => {
                    setName(conv.name);
                    setEditingName(true);
                  }}
                  aria-label="Rename group"
                >
                  <Pencil className="size-3.5" />
                </button>
              )}
            </h3>
          )}
          <p className={`mt-0.5 text-sm ${subtitle === "online" ? "font-medium text-success" : "text-base-content/55"}`}>{subtitle}</p>

          <div className="mt-4 flex gap-2">
            {!group && peer && !peer.deleted && (
              <>
                <button type="button" className="flex w-[72px] flex-col items-center gap-1 rounded-2xl border border-base-300/70 py-2.5 text-xs font-medium transition hover:bg-base-200/60" onClick={() => call("voice")}>
                  <Phone className="size-5 text-primary" /> Voice
                </button>
                <button type="button" className="flex w-[72px] flex-col items-center gap-1 rounded-2xl border border-base-300/70 py-2.5 text-xs font-medium transition hover:bg-base-200/60" onClick={() => call("video")}>
                  <Video className="size-5 text-primary" /> Video
                </button>
              </>
            )}
            <button
              type="button"
              className="flex w-[72px] flex-col items-center gap-1 rounded-2xl border border-base-300/70 py-2.5 text-xs font-medium transition hover:bg-base-200/60"
              onClick={() => {
                if (!docked) close();
                useUIStore.getState().open("searchOpen");
              }}
            >
              <Search className="size-5 text-primary" /> Search
            </button>
            <button
              type="button"
              className="flex w-[72px] flex-col items-center gap-1 rounded-2xl border border-base-300/70 py-2.5 text-xs font-medium transition hover:bg-base-200/60"
              onClick={(e) => setMuteMenu({ anchor: e.currentTarget })}
            >
              {muted ? <BellOff className="size-5 text-primary" /> : <Bell className="size-5 text-primary" />} {muted ? "Muted" : "Mute"}
            </button>
          </div>
        </section>

        {!group && peer && !peer.deleted && (
          <Section>
            {(peer.status?.text || peer.status?.emoji) && (
              <Row icon={MessageCircle} label={`${peer.status.emoji || ""} ${peer.status.text || ""}`.trim()} value={peer.status.expiresAt ? `Status · ${formatUntil(peer.status.expiresAt)}` : "Status"} />
            )}
            {peer.focusUntil && new Date(peer.focusUntil) > new Date() && <Row icon={Timer} label={`Focusing ${formatUntil(peer.focusUntil)}`} value="Notifications are paused for them" />}
            {peer.about && <Row icon={MessageCircle} label={peer.about} value="About" />}
            {isValidTz(peer.timezone) && <Row icon={Clock3} label={`${timeIn(peer.timezone)} local time`} value={`${zoneCity(peer.timezone)} · ${zoneDiffLabel(peer.timezone)}`} />}
            {peer.phone && <Row icon={Phone} label={peer.phone} value="Phone" />}
          </Section>
        )}

        {group && (conv.description || admin) && (
          <Section title="Description">
            <p className="whitespace-pre-wrap text-sm text-base-content/75">{conv.description || "No description"}</p>
            <p className="mt-2 text-xs text-base-content/45">Created {formatLongDate(conv.createdAt)}</p>
          </Section>
        )}

        <SharedMedia conv={conv} />

        <Section title="Chat settings">
          <Row icon={muted ? BellOff : Bell} label="Notifications" value={muted ? (new Date(conv.me.mutedUntil).getFullYear() > 9000 ? "Muted" : `Muted ${formatUntil(conv.me.mutedUntil)}`) : "On"} onClick={(e) => setMuteMenu({ anchor: e.currentTarget })} />
          {(!group || admin) && (
            <Row icon={Timer} label="Disappearing messages" value={conv.disappearingSeconds ? disappearingLabel(conv.disappearingSeconds) : "Off"} onClick={(e) => setTimerMenu({ anchor: e.currentTarget })} />
          )}
          {ai && (
            <Row icon={Languages} label="Translate automatically" value={autoTranslate ? `Into ${me.settings?.language?.toUpperCase() || "EN"}` : "Off"}>
              <input type="checkbox" className="toggle toggle-primary toggle-sm" checked={autoTranslate} onChange={(e) => useSettingsStore.getState().setAutoTranslate(conv._id, e.target.checked)} aria-label="Translate automatically" />
            </Row>
          )}
        </Section>

        {group && (
          <Section
            title={plural(conv.members.length, "member")}
            action={
              admin && (
                <button type="button" className="btn btn-ghost btn-xs gap-1 rounded-lg text-primary" onClick={() => setAdding(true)}>
                  <UserPlus className="size-3.5" /> Add
                </button>
              )
            }
          >
            <ul>
              {sortedMembers.map((m) => (
                <MemberRow key={m.user._id} member={m} conv={conv} me={me} onMessage={goToUser} />
              ))}
            </ul>
          </Section>
        )}

        {!group && details?.commonGroups?.length > 0 && (
          <Section title={`${details.commonGroups.length} group${details.commonGroups.length === 1 ? "" : "s"} in common`}>
            <ul>
              {details.commonGroups.map((g) => (
                <li key={g._id}>
                  <button
                    type="button"
                    onClick={() => {
                      close();
                      navigate(`/chat/${g._id}`, { viewTransition: true });
                    }}
                    className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-xl px-2 py-1.5 text-left transition hover:bg-base-content/[0.05]"
                  >
                    <Avatar src={g.avatar} name={g.name} seed={g._id} group size={36} />
                    <span className="truncate text-[0.92rem] font-medium">{g.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Section>
        )}

        <Section>
          <Row icon={Eraser} label="Clear chat" onClick={() => confirmClear(conv)} />
          {!group && peer && !peer.deleted && (
            <Row icon={conv.blocked ? ShieldCheck : Ban} label={conv.blocked ? `Unblock ${firstName(peer.fullName)}` : `Block ${firstName(peer.fullName)}`} danger={!conv.blocked} onClick={() => confirmBlock(conv)} />
          )}
          <Row
            icon={group ? LogOut : Trash2}
            label={group ? "Exit group" : "Delete chat"}
            danger
            onClick={() =>
              confirmDelete(conv, () => {
                close();
                navigate("/chat", { replace: true });
              })
            }
          />
        </Section>
        <div className="safe-bottom h-4" />
      </div>

      <Menu open={Boolean(muteMenu)} anchor={muteMenu?.anchor} onClose={() => setMuteMenu(null)} title="Notifications" items={muteItems(conv)} />
      <Menu
        open={Boolean(timerMenu)}
        anchor={timerMenu?.anchor}
        onClose={() => setTimerMenu(null)}
        title="Disappearing messages"
        items={TIMERS.map((s) => ({
          key: `t${s}`,
          label: s ? disappearingLabel(s) : "Off",
          checked: conv.disappearingSeconds === s,
          onSelect: () => useChatStore.getState().setDisappearing(conv._id, s).catch((err) => toast.error(errorMessage(err))),
        }))}
      />
      <Sheet
        open={adding}
        onClose={() => setAdding(false)}
        title="Add members"
        size="md"
        tall
        footer={
          <button type="button" className="btn btn-primary h-11 min-h-0 w-full rounded-xl" disabled={!toAdd.length || busy} onClick={addMembers}>
            {busy ? <Spinner className="size-4" /> : `Add${toAdd.length ? ` ${toAdd.length}` : ""}`}
          </button>
        }
      >
        <PeoplePicker multiple selected={toAdd} onChange={setToAdd} exclude={conv.members.map((m) => m.user._id)} />
      </Sheet>
    </div>
  );
}
