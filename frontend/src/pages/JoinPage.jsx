import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { Link2Off, Users } from "lucide-react";
import Avatar from "../components/ui/Avatar";
import Spinner from "../components/ui/Spinner";
import { api, errorMessage } from "../lib/api";
import { plural } from "../lib/format";
import { useChatStore } from "../store/useChatStore";

/** /join/:code — preview a group from its invite link and join it. */
export default function JoinPage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState({ status: "loading" });
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get(`/invites/${encodeURIComponent(code)}`)
      .then((res) => !cancelled && setState({ status: "ready", group: res.data.group }))
      .catch((err) => !cancelled && setState({ status: "error", error: errorMessage(err, "This invite link is invalid or was reset") }));
    return () => {
      cancelled = true;
    };
  }, [code]);

  const join = async () => {
    setJoining(true);
    try {
      const res = await api.post(`/invites/${encodeURIComponent(code)}/join`);
      useChatStore.getState().upsertConversation(res.data.conversation);
      if (!res.data.alreadyMember) toast.success(`You joined ${res.data.conversation.name}`);
      navigate(`/chat/${res.data.conversation._id}`, { replace: true, viewTransition: true });
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't join this group"));
      setJoining(false);
    }
  };

  return (
    <div className="flex flex-1 items-center justify-center overflow-y-auto bg-base-200 p-4">
      <div className="anim-scale-in w-full max-w-sm rounded-3xl bg-base-100 p-6 text-center shadow-float">
        {state.status === "loading" ? (
          <div className="flex justify-center py-16">
            <Spinner className="size-7 text-base-content/40" />
          </div>
        ) : state.status === "error" ? (
          <div className="py-6">
            <span className="mx-auto flex size-16 items-center justify-center rounded-3xl bg-error/10 text-error">
              <Link2Off className="size-7" />
            </span>
            <h1 className="mt-4 text-lg font-semibold">Invite link not working</h1>
            <p className="mt-1 text-sm text-base-content/60">{state.error}</p>
            <button type="button" className="btn mt-6 h-11 min-h-0 w-full rounded-xl" onClick={() => navigate("/chat", { replace: true })}>
              Go to chats
            </button>
          </div>
        ) : (
          <>
            <Avatar src={state.group.avatar} name={state.group.name} seed={state.group._id} group size={96} className="mx-auto" />
            <h1 className="mt-4 text-xl font-semibold tracking-tight">{state.group.name}</h1>
            <p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-base-content/55">
              <Users className="size-4" /> Group · {plural(state.group.memberCount, "member")}
            </p>
            {state.group.description && <p className="mt-3 line-clamp-4 whitespace-pre-wrap text-sm text-base-content/70">{state.group.description}</p>}
            {state.group.memberNames.length > 0 && (
              <p className="mt-3 text-xs text-base-content/50">
                {state.group.memberNames.slice(0, 4).join(", ")}
                {state.group.memberCount > 4 ? ` and ${state.group.memberCount - 4} more` : ""}
              </p>
            )}
            <div className="mt-6 space-y-2">
              {state.group.isMember ? (
                <button type="button" className="btn btn-primary h-11 min-h-0 w-full rounded-xl" onClick={join}>
                  Open group
                </button>
              ) : (
                <button type="button" className="btn btn-primary h-11 min-h-0 w-full rounded-xl" onClick={join} disabled={joining || state.group.full}>
                  {joining ? <Spinner className="size-4" /> : state.group.full ? "This group is full" : "Join group"}
                </button>
              )}
              <button type="button" className="btn btn-ghost h-11 min-h-0 w-full rounded-xl" onClick={() => navigate("/chat", { replace: true })}>
                Not now
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
