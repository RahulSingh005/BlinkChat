import { useEffect, useRef } from "react";
import { Camera, CircleDashed, Pencil, Plus } from "lucide-react";
import PanelHeader from "../components/layout/PanelHeader";
import SplitView, { DetailPlaceholder } from "../components/layout/SplitView";
import Avatar, { StoryRing } from "../components/ui/Avatar";
import { ConversationSkeleton } from "../components/ui/Skeletons";
import { useIsWide } from "../hooks/useMediaQuery";
import { useNow } from "../hooks/useNow";
import { formatAgoShort, plural } from "../lib/format";
import { kindOf } from "../lib/media";
import { useAuthStore } from "../store/useAuthStore";
import { useStoryStore } from "../store/useStoryStore";

function StoryRow({ group, onOpen, index }) {
  const seen = group.stories.filter((s) => s.viewed).length;
  const last = group.stories.at(-1);
  return (
    <button type="button" onClick={onOpen} className="anim-cascade flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-base-content/[0.04]" style={{ "--i": index }}>
      <StoryRing count={group.stories.length} seenCount={seen} size={54}>
        <Avatar src={group.user.profilePic} name={group.user.fullName} seed={group.user._id} size={44} />
      </StoryRing>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.975rem] font-medium">{group.user.fullName}</span>
        <span className="block truncate text-[0.8125rem] text-base-content/55">{formatAgoShort(last.createdAt)} ago</span>
      </span>
    </button>
  );
}

function StoriesList() {
  const me = useAuthStore((s) => s.authUser);
  const mine = useStoryStore((s) => s.mine);
  const others = useStoryStore((s) => s.others);
  const loaded = useStoryStore((s) => s.loaded);
  const wide = useIsWide();
  const fileRef = useRef(null);
  useNow(60000);

  useEffect(() => {
    useStoryStore.getState().fetch();
  }, []);

  const recent = others.filter((g) => g.hasUnseen);
  const viewed = others.filter((g) => !g.hasUnseen);
  const store = useStoryStore.getState();
  const order = others.map((g) => g.user._id);

  const pickMedia = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const kind = kindOf(file);
    if (kind !== "image" && kind !== "video") return;
    store.openComposer({ kind: "media", file });
  };

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col bg-base-100">
      <PanelHeader
        title="Updates"
        actions={
          <>
            <button type="button" className="icon-btn" onClick={() => fileRef.current?.click()} aria-label="Photo or video status" title="Photo or video">
              <Camera className="size-5" />
            </button>
            <button type="button" className="icon-btn" onClick={() => store.openComposer({ kind: "text" })} aria-label="Text status" title="Write a status">
              <Pencil className="size-5" />
            </button>
          </>
        }
      />
      <input ref={fileRef} type="file" accept="image/*,video/*" hidden onChange={pickMedia} />

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-28 md:pb-4">
        <div className="px-2 pb-1 pt-2 text-[0.8125rem] font-semibold text-base-content/55">Status</div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => (mine ? store.openViewer([me._id], 0) : store.openComposer({ kind: "text" }))}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-base-content/[0.04]"
          >
            {mine ? (
              <StoryRing count={mine.stories.length} seenCount={mine.stories.length} size={54}>
                <Avatar src={me.profilePic} name={me.fullName} seed={me._id} size={44} />
              </StoryRing>
            ) : (
              <span className="relative">
                <Avatar src={me.profilePic} name={me.fullName} seed={me._id} size={54} />
                <span className="absolute -bottom-0.5 -right-0.5 flex size-5 items-center justify-center rounded-full bg-primary text-primary-content ring-2 ring-base-100">
                  <Plus className="size-3.5" strokeWidth={3} />
                </span>
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[0.975rem] font-medium">My status</span>
              <span className="block truncate text-[0.8125rem] text-base-content/55">
                {mine ? `${plural(mine.stories.length, "update")} · ${formatAgoShort(mine.stories.at(-1).createdAt)} ago` : "Tap to share a status update"}
              </span>
            </span>
          </button>
          {mine && (
            <button type="button" className="icon-btn mr-1" onClick={() => store.openComposer({ kind: "text" })} aria-label="Add a status update" title="Add">
              <Plus className="size-5" />
            </button>
          )}
        </div>

        {!loaded ? (
          <ConversationSkeleton rows={4} />
        ) : others.length === 0 ? (
          <div className="anim-fade mx-auto max-w-xs px-4 py-12 text-center">
            <span className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl bg-base-200 text-base-content/45">
              <CircleDashed className="size-6" />
            </span>
            <p className="font-semibold">No updates yet</p>
            <p className="mt-1 text-sm text-base-content/55">Status updates from people you chat with appear here and disappear after 24 hours.</p>
          </div>
        ) : (
          <>
            {recent.length > 0 && <div className="px-2 pb-1 pt-4 text-[0.8125rem] font-semibold text-base-content/55">Recent updates</div>}
            {recent.map((g, i) => (
              <StoryRow key={g.user._id} group={g} index={i} onOpen={() => store.openViewer(order, order.indexOf(g.user._id))} />
            ))}
            {viewed.length > 0 && <div className="px-2 pb-1 pt-4 text-[0.8125rem] font-semibold text-base-content/55">Viewed updates</div>}
            {viewed.map((g, i) => (
              <StoryRow key={g.user._id} group={g} index={i + recent.length} onOpen={() => store.openViewer(order, order.indexOf(g.user._id))} />
            ))}
          </>
        )}
        <p className="px-4 pt-6 text-center text-xs text-base-content/40">Your status updates are visible to people you've chatted with 1:1.</p>
      </div>

      {!wide && (
        <div className="absolute bottom-4 right-4 z-10 flex flex-col items-center gap-3">
          <button type="button" onClick={() => store.openComposer({ kind: "text" })} className="anim-pop flex size-11 items-center justify-center rounded-xl bg-base-200 text-base-content shadow-soft transition active:scale-95" aria-label="Text status">
            <Pencil className="size-5" />
          </button>
          <button type="button" onClick={() => fileRef.current?.click()} className="anim-pop flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-content shadow-float transition active:scale-95" aria-label="Photo or video status">
            <Camera className="size-6" />
          </button>
        </div>
      )}
    </div>
  );
}

export default function UpdatesPage() {
  return (
    <SplitView
      list={<StoriesList />}
      detail={
        <DetailPlaceholder
          icon={CircleDashed}
          title="Share moments that disappear"
          body="Post a photo, video or a colorful text status. It's visible to people you chat with and disappears after 24 hours."
        />
      }
    />
  );
}
