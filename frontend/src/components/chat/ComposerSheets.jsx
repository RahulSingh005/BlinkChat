import { useCallback, useEffect, useRef, useState } from "react";
import { LocateFixed, MapPin, Plus, RefreshCw, X } from "lucide-react";
import PeoplePicker from "./PeoplePicker";
import { StaticMap } from "./RichContent";
import Sheet from "../ui/Sheet";
import Spinner from "../ui/Spinner";

const MAX_OPTIONS = 12;

/** Create a poll: question, 2–12 options, single or multiple answers. */
export function PollSheet({ open, onClose, onSubmit }) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [multiple, setMultiple] = useState(false);
  const listRef = useRef(null);

  useEffect(() => {
    if (!open) {
      setQuestion("");
      setOptions(["", ""]);
      setMultiple(false);
    }
  }, [open]);

  const setOption = (i, value) =>
    setOptions((prev) => {
      const next = prev.map((o, j) => (j === i ? value : o));
      // Always keep one empty slot at the end (until the limit).
      if (next.at(-1).trim() && next.length < MAX_OPTIONS) next.push("");
      return next;
    });

  const removeOption = (i) => setOptions((prev) => (prev.length <= 2 ? prev : prev.filter((_, j) => j !== i)));

  const filled = options.map((o) => o.trim()).filter(Boolean);
  const unique = new Set(filled.map((o) => o.toLowerCase())).size === filled.length;
  const valid = question.trim() && filled.length >= 2 && unique;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Create poll"
      size="md"
      footer={
        <button
          type="button"
          className="btn btn-primary h-11 min-h-0 w-full rounded-xl"
          disabled={!valid}
          onClick={() => {
            onSubmit({ question: question.trim(), options: filled, multiple });
            onClose();
          }}
        >
          Send poll
        </button>
      }
    >
      <label className="field-label" htmlFor="poll-question">
        Question
      </label>
      <input id="poll-question" value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={200} placeholder="Ask a question" className="field" data-autofocus />

      <p className="field-label mt-4">Options</p>
      <ul ref={listRef} className="space-y-2">
        {options.map((o, i) => (
          <li key={i} className="anim-fade flex items-center gap-2">
            <input
              value={o}
              onChange={(e) => setOption(i, e.target.value)}
              maxLength={100}
              placeholder={i < 2 ? `Option ${i + 1}` : "Add option"}
              className="field h-11"
              aria-label={`Option ${i + 1}`}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  listRef.current?.querySelectorAll("input")[i + 1]?.focus();
                }
              }}
            />
            {options.length > 2 && o && (
              <button type="button" className="icon-btn icon-btn-sm" onClick={() => removeOption(i)} aria-label={`Remove option ${i + 1}`}>
                <X className="size-4" />
              </button>
            )}
          </li>
        ))}
      </ul>
      {!unique && <p className="mt-2 text-xs text-error">Options must be different.</p>}
      {options.length >= MAX_OPTIONS && (
        <p className="mt-2 flex items-center gap-1 text-xs text-base-content/50">
          <Plus className="size-3" /> Polls can have up to {MAX_OPTIONS} options.
        </p>
      )}

      <label className="mt-4 flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-base-200/70 px-3.5 py-3">
        <span>
          <span className="block text-sm font-medium">Allow multiple answers</span>
          <span className="block text-xs text-base-content/55">People can pick more than one option</span>
        </span>
        <input type="checkbox" className="toggle toggle-primary toggle-sm" checked={multiple} onChange={(e) => setMultiple(e.target.checked)} />
      </label>
    </Sheet>
  );
}

/** Share your current location (browser geolocation, no tracking). */
export function LocationSheet({ open, onClose, onSubmit }) {
  const [state, setState] = useState({ status: "idle" });
  const [label, setLabel] = useState("");

  const locate = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setState({ status: "error", error: "Location isn't available in this browser." });
      return;
    }
    setState({ status: "locating" });
    navigator.geolocation.getCurrentPosition(
      (pos) => setState({ status: "ready", lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      (err) =>
        setState({
          status: "error",
          error: err.code === 1 ? "Location permission was denied. Allow it in your browser's site settings." : "Couldn't get your location. Try again.",
        }),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    );
  }, []);

  useEffect(() => {
    if (open) locate();
    else {
      setState({ status: "idle" });
      setLabel("");
    }
  }, [open, locate]);

  const ready = state.status === "ready";

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Share location"
      description="Sends a one-time snapshot of where you are now."
      size="md"
      footer={
        <button
          type="button"
          className="btn btn-primary h-11 min-h-0 w-full rounded-xl"
          disabled={!ready}
          onClick={() => {
            onSubmit({ lat: state.lat, lng: state.lng, accuracy: state.accuracy ? Math.round(state.accuracy) : null, label: label.trim() });
            onClose();
          }}
        >
          <MapPin className="size-4" /> Send this location
        </button>
      }
    >
      <div className="overflow-hidden rounded-2xl border border-base-300/70">
        {ready ? (
          <StaticMap lat={state.lat} lng={state.lng} width={460} height={200} zoom={16} />
        ) : (
          <div className="flex h-[200px] flex-col items-center justify-center gap-3 bg-base-200/70 px-6 text-center text-sm text-base-content/60">
            {state.status === "error" ? (
              <>
                {state.error}
                <button type="button" className="btn btn-sm rounded-lg" onClick={locate}>
                  <RefreshCw className="size-3.5" /> Try again
                </button>
              </>
            ) : (
              <>
                <Spinner className="size-6 text-primary" />
                Finding your location…
              </>
            )}
          </div>
        )}
      </div>
      {ready && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-base-content/55">
          <LocateFixed className="size-3.5" /> Accurate to about {Math.max(1, Math.round(state.accuracy))} m
        </p>
      )}
      <label className="field-label mt-4" htmlFor="loc-label">
        Name this place <span className="font-normal text-base-content/45">(optional)</span>
      </label>
      <input id="loc-label" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={120} placeholder="e.g. Home, Office, Café" className="field" />
    </Sheet>
  );
}

/** Share someone's contact card. */
export function ContactSheet({ open, onClose, onSubmit }) {
  return (
    <Sheet open={open} onClose={onClose} title="Share contact" size="md" tall>
      <PeoplePicker
        onPick={(user) => {
          onSubmit(user);
          onClose();
        }}
      />
    </Sheet>
  );
}
