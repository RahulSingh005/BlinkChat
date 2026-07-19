import { useEffect, useRef, useState } from "react";
import {
  Mic,
  MicOff,
  PhoneOff,
  Phone,
  Video,
  VideoOff,
  Volume2,
} from "lucide-react";
import { useCallStore } from "../store/useCallStore";
import { getInitials } from "../lib/utils";

const formatDuration = (startedAt) => {
  if (!startedAt) return "00:00";
  const secs = Math.floor((Date.now() - startedAt) / 1000);
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
};

const CallModal = () => {
  const {
    callStatus,
    callType,
    peer,
    localStream,
    remoteStream,
    isMuted,
    isCameraOff,
    callStartedAt,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleCamera,
  } = useCallStore();

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const [duration, setDuration] = useState("00:00");

  useEffect(() => {
    if (localVideoRef.current) localVideoRef.current.srcObject = localStream || null;
  }, [localStream]);

  useEffect(() => {
    if (callType === "video" && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream || null;
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = remoteStream || null;
    }
  }, [remoteStream, callType]);

  useEffect(() => {
    if (callStatus !== "active") return;
    const id = setInterval(() => setDuration(formatDuration(callStartedAt)), 1000);
    return () => clearInterval(id);
  }, [callStatus, callStartedAt]);

  if (callStatus === "idle") return null;

  const isVideo = callType === "video";
  const name = peer?.fullName || "Unknown";

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <audio ref={remoteAudioRef} autoPlay className={isVideo ? "hidden" : ""} />

      <div className="relative w-full max-w-md sm:max-w-lg rounded-3xl overflow-hidden shadow-2xl bg-gradient-to-b from-neutral to-neutral/90 text-neutral-content">
        {isVideo && callStatus === "active" ? (
          <div className="relative aspect-[3/4] sm:aspect-video bg-black">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            {!remoteStream && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <Avatar peer={peer} size="size-24" />
                <p className="text-sm text-white/60">Connecting video…</p>
              </div>
            )}
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="absolute bottom-4 right-4 w-24 h-32 sm:w-32 sm:h-40 rounded-xl object-cover border-2 border-white/20 shadow-lg bg-black"
            />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 py-14 px-6">
            <Avatar peer={peer} size="size-28" ring />
            <div className="text-center">
              <h2 className="text-2xl font-bold">{name}</h2>
              <p className="text-sm text-white/60 mt-1">
                {callStatus === "outgoing" && "Calling…"}
                {callStatus === "incoming" && `Incoming ${isVideo ? "video" : "voice"} call…`}
                {callStatus === "active" && (
                  <span className="inline-flex items-center gap-1.5">
                    <Volume2 className="size-3.5" /> {duration}
                  </span>
                )}
              </p>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="px-6 pb-8 pt-6 bg-black/30">
          {callStatus === "incoming" ? (
            <div className="flex items-center justify-center gap-8">
              <button
                onClick={rejectCall}
                aria-label="Decline call"
                className="btn btn-circle btn-lg bg-error hover:bg-error/80 border-none text-white shadow-lg"
              >
                <PhoneOff className="size-6" />
              </button>
              <button
                onClick={acceptCall}
                aria-label="Accept call"
                className="btn btn-circle btn-lg bg-success hover:bg-success/80 border-none text-white shadow-lg animate-bounce-subtle"
              >
                <Phone className="size-6" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={toggleMute}
                aria-label={isMuted ? "Unmute" : "Mute"}
                className={`btn btn-circle ${isMuted ? "bg-white text-neutral" : "bg-white/10 text-white"} border-none`}
              >
                {isMuted ? <MicOff className="size-5" /> : <Mic className="size-5" />}
              </button>

              {isVideo && (
                <button
                  onClick={toggleCamera}
                  aria-label={isCameraOff ? "Turn camera on" : "Turn camera off"}
                  className={`btn btn-circle ${isCameraOff ? "bg-white text-neutral" : "bg-white/10 text-white"} border-none`}
                >
                  {isCameraOff ? <VideoOff className="size-5" /> : <Video className="size-5" />}
                </button>
              )}

              <button
                onClick={() => endCall(true)}
                aria-label="End call"
                className="btn btn-circle bg-error hover:bg-error/80 border-none text-white shadow-lg px-6 w-16"
              >
                <PhoneOff className="size-6" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const Avatar = ({ peer, size = "size-20", ring = false }) => {
  if (peer?.profilePic) {
    return (
      <img
        src={peer.profilePic}
        alt={peer.fullName}
        className={`${size} rounded-full object-cover ${ring ? "ring-4 ring-white/20" : ""}`}
      />
    );
  }
  return (
    <div
      className={`${size} rounded-full bg-gradient-to-br from-primary/60 to-secondary/60 flex items-center justify-center font-bold text-2xl ${
        ring ? "ring-4 ring-white/20" : ""
      }`}
    >
      {getInitials(peer?.fullName)}
    </div>
  );
};

export default CallModal;
