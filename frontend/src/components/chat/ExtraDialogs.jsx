import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Check, CheckCheck, Copy, Link2, RotateCcw, Share2, Trash2 } from "lucide-react";
import Avatar from "../ui/Avatar";
import QrCode from "../ui/QrCode";
import Sheet from "../ui/Sheet";
import Spinner from "../ui/Spinner";
import { errorMessage } from "../../lib/api";
import { formatDateTime } from "../../lib/format";
import { previewText } from "../../lib/preview";
import { useAuthStore } from "../../store/useAuthStore";
import { useChatStore } from "../../store/useChatStore";
import { useUIStore } from "../../store/useUIStore";

const origin = () => window.location.origin;

async function copy(text, label = "Link copied") {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(label);
  } catch {
    toast.error("Couldn't copy");
  }
}

async function share({ title, text, url }) {
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return;
    } catch (err) {
      if (err?.name === "AbortError") return;
    }
  }
  copy(url);
}

function PersonRow({ user, meId, right }) {
  return (
    <li className="flex items-center gap-3 py-1.5">
      <Avatar src={user.profilePic} name={user.fullName} seed={user._id} size={36} />
      <span className="min-w-0 flex-1 truncate text-[0.92rem] font-medium">{user._id === meId ? "You" : user.fullName}</span>
      {right}
    </li>
  );
}

/** Who has received / read one of my messages. */
export function MessageInfoSheet() {
  const state = useUIStore((s) => s.messageInfo);
  const close = () => useUIStore.getState().close("messageInfo");
  const me = useAuthStore((s) => s.authUser);
  const conv = useChatStore((s) => (state ? s.conversations[state.conversationId] : null));
  const message = useChatStore((s) => (state ? s.threads[state.conversationId]?.items.find((m) => m._id === state.messageId) : null));

  const groups = useMemo(() => {
    if (!conv || !message) return null;
    const t = new Date(message.createdAt).getTime();
    const reached = (d) => d && new Date(d).getTime() >= t;
    const others = conv.members.filter((m) => m.user._id !== me._id && !m.user.deleted);
    return {
      read: others.filter((m) => reached(m.lastReadAt)),
      delivered: others.filter((m) => !reached(m.lastReadAt) && reached(m.lastDeliveredAt)),
      pending: others.filter((m) => !reached(m.lastReadAt) && !reached(m.lastDeliveredAt)),
      hiddenReceipts: others.some((m) => m.lastReadAt === null),
    };
  }, [conv, message, me._id]);

  return (
    <Sheet open={Boolean(state && message)} onClose={close} title="Message info" description={message ? `Sent ${formatDateTime(message.createdAt)}` : ""} size="sm">
      {message && groups && (
        <div className="space-y-4">
          <p className="line-clamp-3 rounded-2xl bg-base-200/70 px-3.5 py-2.5 text-sm">{previewText(message, { conv, meId: me._id }) || "Message"}</p>
          <section>
            <h3 className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-base-content/50">
              <CheckCheck className="tick-read size-4" /> Read by
            </h3>
            {groups.read.length ? (
              <ul>
                {groups.read.map((m) => (
                  <PersonRow key={m.user._id} user={m.user} meId={me._id} />
                ))}
              </ul>
            ) : (
              <p className="py-1 text-sm text-base-content/50">No one yet</p>
            )}
          </section>
          <section>
            <h3 className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-base-content/50">
              <CheckCheck className="size-4" /> Delivered to
            </h3>
            {groups.delivered.length ? (
              <ul>
                {groups.delivered.map((m) => (
                  <PersonRow key={m.user._id} user={m.user} meId={me._id} />
                ))}
              </ul>
            ) : (
              <p className="py-1 text-sm text-base-content/50">{groups.read.length ? "Everyone has read it" : "No one yet"}</p>
            )}
          </section>
          {groups.pending.length > 0 && (
            <section>
              <h3 className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-base-content/50">
                <Check className="size-4" /> Sent to
              </h3>
              <ul>
                {groups.pending.map((m) => (
                  <PersonRow key={m.user._id} user={m.user} meId={me._id} />
                ))}
              </ul>
            </section>
          )}
          {groups.hiddenReceipts && <p className="text-xs text-base-content/45">Some people have read receipts turned off, so you may not see when they read it.</p>}
        </div>
      )}
    </Sheet>
  );
}

/** Voters per poll option. */
export function PollVotesSheet() {
  const state = useUIStore((s) => s.pollVotes);
  const close = () => useUIStore.getState().close("pollVotes");
  const me = useAuthStore((s) => s.authUser);
  const conv = useChatStore((s) => (state ? s.conversations[state.conversationId] : null));
  const message = useChatStore((s) => (state ? s.threads[state.conversationId]?.items.find((m) => m._id === state.messageId) : null));
  const byId = useMemo(() => new Map((conv?.members || []).map((m) => [m.user._id, m.user])), [conv?.members]);

  return (
    <Sheet open={Boolean(state && message?.poll)} onClose={close} title="Poll votes" description={message?.poll?.question} size="sm">
      {message?.poll && (
        <div className="space-y-4">
          {message.poll.options.map((o) => (
            <section key={o.id}>
              <h3 className="mb-1 flex items-baseline justify-between gap-3">
                <span className="text-sm font-semibold">{o.text}</span>
                <span className="shrink-0 text-xs text-base-content/50">
                  {o.voters.length} vote{o.voters.length === 1 ? "" : "s"}
                </span>
              </h3>
              {o.voters.length ? (
                <ul>
                  {o.voters.map((id) => (
                    <PersonRow key={id} user={byId.get(id) || { _id: id, fullName: "Former member" }} meId={me._id} />
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-base-content/45">No votes</p>
              )}
            </section>
          ))}
        </div>
      )}
    </Sheet>
  );
}

/** Group invite link: create, copy, share, QR, reset and revoke. */
export function InviteSheet() {
  const conversationId = useUIStore((s) => s.invite);
  const close = () => useUIStore.getState().close("invite");
  const conv = useChatStore((s) => (conversationId ? s.conversations[conversationId] : null));
  const [busy, setBusy] = useState(false);
  const code = conv?.inviteCode;
  const link = code ? `${origin()}/join/${code}` : "";

  const run = async (fn, ok) => {
    setBusy(true);
    try {
      await fn();
      if (ok) toast.success(ok);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    const ok = await useUIStore.getState().ask({
      title: "Reset invite link?",
      body: "The current link will stop working. Anyone who has it won't be able to join.",
      confirmLabel: "Reset link",
      danger: true,
    });
    if (ok) run(() => useChatStore.getState().createInvite(conversationId), "New link created");
  };

  const revoke = async () => {
    const ok = await useUIStore.getState().ask({ title: "Turn off invite link?", body: "Nobody will be able to join with a link until you create a new one.", confirmLabel: "Turn off", danger: true });
    if (ok) run(() => useChatStore.getState().revokeInvite(conversationId), "Invite link turned off");
  };

  return (
    <Sheet open={Boolean(conv)} onClose={close} title="Invite via link" description={conv ? `Anyone with this link can join “${conv.name}”.` : ""} size="sm">
      {conv &&
        (code ? (
          <div className="flex flex-col items-center">
            <div className="anim-scale-in rounded-3xl border border-base-300/70 p-3">
              <QrCode value={link} size={200} />
            </div>
            <div className="mt-4 flex w-full items-center gap-2 rounded-xl bg-base-200/70 py-1.5 pl-3 pr-1.5">
              <Link2 className="size-4 shrink-0 text-base-content/50" />
              <span className="min-w-0 flex-1 truncate text-sm">{link}</span>
              <button type="button" className="btn btn-sm rounded-lg" onClick={() => copy(link)}>
                <Copy className="size-3.5" /> Copy
              </button>
            </div>
            <div className="mt-3 grid w-full grid-cols-3 gap-2">
              <button type="button" className="btn h-auto min-h-0 flex-col gap-1 rounded-xl py-2.5 text-xs" onClick={() => share({ title: conv.name, text: `Join “${conv.name}” on BlinkChat`, url: link })}>
                <Share2 className="size-4" /> Share
              </button>
              <button type="button" className="btn h-auto min-h-0 flex-col gap-1 rounded-xl py-2.5 text-xs" onClick={reset} disabled={busy}>
                <RotateCcw className="size-4" /> Reset
              </button>
              <button type="button" className="btn h-auto min-h-0 flex-col gap-1 rounded-xl py-2.5 text-xs text-error" onClick={revoke} disabled={busy}>
                <Trash2 className="size-4" /> Turn off
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <span className="flex size-16 items-center justify-center rounded-3xl bg-primary/10 text-primary">
              <Link2 className="size-7" />
            </span>
            <p className="text-sm text-base-content/60">Create a link people can open to join this group. You can reset or turn it off at any time.</p>
            <button type="button" className="btn btn-primary h-11 min-h-0 w-full rounded-xl" disabled={busy} onClick={() => run(() => useChatStore.getState().createInvite(conversationId))}>
              {busy ? <Spinner className="size-4" /> : "Create invite link"}
            </button>
          </div>
        ))}
    </Sheet>
  );
}

/** My profile link + QR code (opens a chat with me when scanned). */
export function ShareProfileSheet() {
  const open = useUIStore((s) => s.shareProfile);
  const me = useAuthStore((s) => s.authUser);
  const close = () => useUIStore.getState().close("shareProfile");
  const link = me ? `${origin()}/u/${me._id}` : "";
  return (
    <Sheet open={open} onClose={close} title="My QR code" description="People can scan this to start a chat with you." size="sm">
      {me && (
        <div className="flex flex-col items-center">
          <div className="anim-scale-in relative rounded-3xl border border-base-300/70 p-3">
            <QrCode value={link} size={210} ecc="Q" />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white p-1">
              <Avatar src={me.profilePic} name={me.fullName} seed={me._id} size={40} />
            </span>
          </div>
          <p className="mt-3 font-semibold">{me.fullName}</p>
          <div className="mt-4 grid w-full grid-cols-2 gap-2">
            <button type="button" className="btn h-11 min-h-0 rounded-xl" onClick={() => copy(link)}>
              <Copy className="size-4" /> Copy link
            </button>
            <button type="button" className="btn btn-primary h-11 min-h-0 rounded-xl" onClick={() => share({ title: me.fullName, text: `Chat with me on BlinkChat`, url: link })}>
              <Share2 className="size-4" /> Share
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
