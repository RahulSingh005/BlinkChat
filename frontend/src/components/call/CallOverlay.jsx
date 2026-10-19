import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Maximize2, Mic, MicOff, Minimize2, MonitorUp, Phone, PhoneOff, SwitchCamera, Video, VideoOff, Volume2 } from "lucide-react";
import Avatar from "../ui/Avatar";
import { useNow } from "../../hooks/useNow";
import { formatDuration, firstName } from "../../lib/format";
import { useCallStore } from "../../store/useCallStore";

function MediaVideo({ stream, muted = false, mirrored = false, className = "" }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream || null;
  }, [stream]);
  return <video ref={ref} autoPlay playsInline muted={muted} className={`${className} ${mirrored ? "-scale-x-100" : ""}`} />;
}

/** Remote audio lives outside the video element so it never plays twice. */
function RemoteAudio({ stream, onBlocked }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = stream || null;
    if (stream) el.play().catch(() => onBlocked(true));
  }, [stream, onBlocked]);
  return <audio ref={ref} autoPlay playsInline />;
}

function Control({ onClick, active = false, danger = false, label, children, big = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex shrink-0 items-center justify-center rounded-full transition active:scale-95 ${big ? "size-16" : "size-14"} ${
        danger ? "bg-error text-white hover:bg-error/90" : active ? "bg-white text-[#111317]" : "bg-white/15 text-white backdrop-blur hover:bg-white/20"
      }`}
    >
      {children}
    </button>
  );
}

function Rings() {
  return (
    <>
      <span className="ring-wave absolute inset-0 rounded-full border-2 border-white/30" />
      <span className="ring-wave absolute inset-0 rounded-full border-2 border-white/20" style={{ animationDelay: "0.6s" }} />
      <span className="ring-wave absolute inset-0 rounded-full border-2 border-white/10" style={{ animationDelay: "1.2s" }} />
    </>
  );
}

export default function CallOverlay() {
  const call = useCallStore();
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [pip, setPip] = useState({ x: null, y: null });
  const hideTimer = useRef(0);
  const drag = useRef(null);
  useNow(call.status === "active" ? 1000 : 60000);

  const isVideo = call.type === "video";
  const active = call.status === "active" || call.status === "connecting";
  const hasRemoteVideo = Boolean(call.remoteStream?.getVideoTracks().length) && call.remoteVideo !== false;
  const duration = call.startedAt ? formatDuration((Date.now() - call.startedAt) / 1000) : "";
  const reconnecting = call.connection === "disconnected";

  // Auto-hide video controls on touch screens after a few seconds.
  const poke = () => {
    setControlsVisible(true);
    clearTimeout(hideTimer.current);
    if (isVideo && call.status === "active") hideTimer.current = setTimeout(() => setControlsVisible(false), 3500);
  };
  useEffect(() => {
    if (call.status !== "active") setControlsVisible(true);
    return () => clearTimeout(hideTimer.current);
  }, [call.status]);

  if (call.status === "idle") return null;
  const name = call.peer?.fullName || "Unknown";
  const statusText =
    call.status === "incoming"
      ? `Incoming ${isVideo ? "video" : "voice"} call`
      : call.status === "outgoing"
        ? "Calling…"
        : call.status === "connecting"
          ? "Connecting…"
          : reconnecting
            ? "Reconnecting…"
            : duration;

  if (call.minimized && active) {
    return createPortal(
      <div className="anim-scale-in fixed bottom-24 right-4 z-[85] flex w-[260px] items-center gap-3 rounded-2xl bg-neutral p-2.5 pr-3 text-neutral-content shadow-float md:bottom-6">
        <RemoteAudio stream={call.remoteStream} onBlocked={setAudioBlocked} />
        {isVideo && hasRemoteVideo ? (
          <MediaVideo stream={call.remoteStream} muted className="h-14 w-20 rounded-xl bg-black object-cover" />
        ) : (
          <Avatar src={call.peer?.profilePic} name={name} seed={call.peer?._id} size={44} />
        )}
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => call.setMinimized(false)}>
          <span className="block truncate text-sm font-semibold">{name}</span>
          <span className="block text-xs tabular-nums opacity-70">{statusText}</span>
        </button>
        <button type="button" onClick={() => call.setMinimized(false)} className="flex size-9 items-center justify-center rounded-full bg-white/10" aria-label="Expand call">
          <Maximize2 className="size-4" />
        </button>
        <button type="button" onClick={call.hangUp} className="flex size-9 items-center justify-center rounded-full bg-error text-white" aria-label="End call">
          <PhoneOff className="size-4" />
        </button>
      </div>,
      document.body
    );
  }

  const showVideoStage = isVideo && active;

  const onPipDown = (e) => {
    drag.current = { sx: e.clientX, sy: e.clientY, ox: e.currentTarget.offsetLeft, oy: e.currentTarget.offsetTop };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPipMove = (e) => {
    if (!drag.current) return;
    setPip({ x: drag.current.ox + e.clientX - drag.current.sx, y: drag.current.oy + e.clientY - drag.current.sy });
  };
  const onPipUp = (e) => {
    if (!drag.current) return;
    drag.current = null;
    // Snap to the nearest corner.
    const w = e.currentTarget.offsetWidth;
    const h = e.currentTarget.offsetHeight;
    const right = (pip.x ?? 0) + w / 2 > window.innerWidth / 2;
    const bottom = (pip.y ?? 0) + h / 2 > window.innerHeight / 2;
    setPip({ x: right ? window.innerWidth - w - 16 : 16, y: bottom ? window.innerHeight - h - 140 : 80 });
  };

  return createPortal(
    <div
      className="anim-fade fixed inset-0 z-[85] flex flex-col overflow-hidden bg-[#141414] text-white md:items-center md:justify-center md:bg-black/70 md:p-6 md:backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`Call with ${name}`}
      onPointerMove={poke}
      onClick={poke}
    >
      <RemoteAudio stream={call.remoteStream} onBlocked={setAudioBlocked} />

      <div className="relative flex h-full w-full flex-col overflow-hidden bg-gradient-to-b from-slate-800 to-slate-950 md:h-[min(720px,90vh)] md:max-w-[960px] md:rounded-3xl md:shadow-float">
        {showVideoStage && (
          <div className="absolute inset-0 bg-black">
            {hasRemoteVideo ? (
              <MediaVideo stream={call.remoteStream} muted className={`size-full ${call.remoteScreen ? "object-contain" : "object-cover"}`} />
            ) : (
              <div className="flex size-full flex-col items-center justify-center gap-4">
                <Avatar src={call.peer?.profilePic} name={name} seed={call.peer?._id} size={112} />
                <p className="text-sm text-white/60">{call.status === "active" ? `${firstName(name)}'s camera is off` : "Connecting video…"}</p>
              </div>
            )}
          </div>
        )}

        {/* Top bar */}
        <div className={`safe-top relative z-10 flex items-center gap-3 bg-gradient-to-b from-black/50 to-transparent px-4 pb-6 pt-4 transition-opacity duration-300 ${controlsVisible ? "opacity-100" : "opacity-0"}`}>
          {active && (
            <button type="button" onClick={() => call.setMinimized(true)} className="flex size-10 items-center justify-center rounded-full bg-white/10 backdrop-blur hover:bg-white/20" aria-label="Minimize call">
              <Minimize2 className="size-[18px]" />
            </button>
          )}
          {showVideoStage && (
            <div className="min-w-0">
              <p className="truncate font-semibold">{name}</p>
              <p className="text-xs tabular-nums text-white/70">{statusText}</p>
            </div>
          )}
          {call.remoteAudio === false && call.status === "active" && (
            <span className="ml-auto flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-1 text-xs">
              <MicOff className="size-3.5" /> {firstName(name)} is muted
            </span>
          )}
        </div>

        {/* Voice / ringing stage */}
        {!showVideoStage && (
          <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
            <div className="relative">
              {(call.status === "incoming" || call.status === "outgoing") && <Rings />}
              <Avatar src={call.peer?.profilePic} name={name} seed={call.peer?._id} size={128} />
            </div>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">{name}</h2>
              <p className="mt-1 text-sm tabular-nums text-white/65">{statusText}</p>
            </div>
          </div>
        )}
        {showVideoStage && <div className="flex-1" />}

        {/* Local preview */}
        {showVideoStage && call.localStream && (
          <div
            className="absolute z-20 h-44 w-28 cursor-grab touch-none overflow-hidden rounded-2xl border border-white/20 bg-black shadow-float md:h-48 md:w-36"
            style={pip.x === null ? { right: 16, top: 88 } : { left: pip.x, top: pip.y, transition: drag.current ? "none" : "left 0.25s var(--spring), top 0.25s var(--spring)" }}
            onPointerDown={onPipDown}
            onPointerMove={onPipMove}
            onPointerUp={onPipUp}
          >
            {call.cameraOff ? (
              <div className="flex size-full items-center justify-center text-white/60">
                <VideoOff className="size-6" />
              </div>
            ) : (
              <MediaVideo stream={call.localStream} muted mirrored={call.facing === "user" && !call.screenSharing} className="size-full object-cover" />
            )}
          </div>
        )}

        {audioBlocked && (
          <button type="button" onClick={() => document.querySelectorAll("audio").forEach((a) => a.play().then(() => setAudioBlocked(false)).catch(() => {}))} className="absolute left-1/2 top-24 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#111317] shadow-float">
            <Volume2 className="size-4" /> Tap to turn on sound
          </button>
        )}

        {/* Controls */}
        <div className={`safe-bottom relative z-10 bg-gradient-to-t from-black/60 to-transparent px-6 pb-8 pt-10 transition-opacity duration-300 ${controlsVisible ? "opacity-100" : "pointer-events-none opacity-0"}`}>
          {call.status === "incoming" ? (
            <div className="flex flex-col items-center gap-5">
              <div className="flex items-center justify-center gap-16">
                <div className="flex flex-col items-center gap-2">
                  <Control onClick={call.decline} danger big label="Decline">
                    <PhoneOff className="size-7" />
                  </Control>
                  <span className="text-xs text-white/70">Decline</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <button type="button" onClick={() => call.acceptCall()} aria-label="Accept" className="flex size-16 items-center justify-center rounded-full bg-success text-white shadow-lg transition active:scale-95">
                    {isVideo ? <Video className="size-7" /> : <Phone className="size-7" />}
                  </button>
                  <span className="text-xs text-white/70">Accept</span>
                </div>
              </div>
              {isVideo && (
                <button type="button" onClick={() => call.acceptCall({ audioOnly: true })} className="text-sm font-medium text-white/75 underline-offset-4 hover:underline">
                  Answer with audio only
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center gap-3 md:gap-4">
              <Control onClick={call.toggleMute} active={call.muted} label={call.muted ? "Unmute" : "Mute"}>
                {call.muted ? <MicOff className="size-6" /> : <Mic className="size-6" />}
              </Control>
              {isVideo && (
                <Control onClick={call.toggleCamera} active={call.cameraOff} label={call.cameraOff ? "Turn camera on" : "Turn camera off"}>
                  {call.cameraOff ? <VideoOff className="size-6" /> : <Video className="size-6" />}
                </Control>
              )}
              {isVideo && call.canFlip && (
                <Control onClick={call.flipCamera} label="Switch camera">
                  <SwitchCamera className="size-6" />
                </Control>
              )}
              {isVideo && active && typeof navigator.mediaDevices?.getDisplayMedia === "function" && (
                <span className="hidden md:block">
                  <Control onClick={call.toggleScreenShare} active={call.screenSharing} label={call.screenSharing ? "Stop sharing" : "Share screen"}>
                    <MonitorUp className="size-6" />
                  </Control>
                </span>
              )}
              <Control onClick={call.hangUp} danger big label={call.status === "outgoing" ? "Cancel call" : "End call"}>
                <PhoneOff className="size-7" />
              </Control>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
