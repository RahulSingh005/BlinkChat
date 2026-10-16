import { create } from "zustand";
import toast from "react-hot-toast";
import { api } from "../lib/api";
import { firstName } from "../lib/format";
import { sounds } from "../lib/sound";
import { useAuthStore } from "./useAuthStore";

/**
 * 1:1 WebRTC calls. Signaling goes through Socket.IO (see backend
 * socket/calls.js). Media flows peer-to-peer, relayed through TURN when a
 * direct path isn't possible.
 */
let pc = null;
let localStream = null;
let cameraTrack = null;
let screenTrack = null;
let remoteQueue = []; // remote ICE candidates waiting for setRemoteDescription
let localQueue = []; // our candidates waiting for the call id
let stopTone = null;
let watchdog = null;
let dropTimer = null;
let iceCache = { servers: null, at: 0 };

const socket = () => useAuthStore.getState().socket;

const INITIAL = {
  status: "idle", // idle | outgoing | incoming | connecting | active
  callId: null,
  conversationId: null,
  type: "voice",
  direction: null,
  peer: null,
  offer: null,
  localStream: null,
  remoteStream: null,
  remoteTracks: 0,
  muted: false,
  cameraOff: false,
  screenSharing: false,
  facing: "user",
  canFlip: false,
  remoteAudio: true,
  remoteVideo: true,
  remoteScreen: false,
  startedAt: null,
  minimized: false,
  connection: "new",
};

async function getIceServers() {
  if (iceCache.servers && Date.now() - iceCache.at < 10 * 60 * 1000) return iceCache.servers;
  try {
    const res = await api.get("/calls/ice-servers");
    iceCache = { servers: res.data.iceServers, at: Date.now() };
  } catch {
    iceCache = { servers: [{ urls: "stun:stun.l.google.com:19302" }], at: Date.now() };
  }
  return iceCache.servers;
}

export function mediaErrorMessage(err, video = false) {
  const device = video ? "camera and microphone" : "microphone";
  if (err?.name === "NotAllowedError" || err?.name === "SecurityError") return `Allow ${device} access to make calls.`;
  if (err?.name === "NotFoundError" || err?.name === "OverconstrainedError") return `No ${device} found on this device.`;
  if (err?.name === "NotReadableError") return `Your ${device} is being used by another app.`;
  if (!window.isSecureContext) return "Calls require a secure (https) connection.";
  return `Couldn't access your ${device}.`;
}

const AUDIO = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };

async function getMedia(type) {
  if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error("unsupported"), { name: "NotSupportedError" });
  if (type === "video") {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: AUDIO,
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      return { stream, video: true };
    } catch (err) {
      if (err?.name === "NotAllowedError") throw err;
      // No / busy camera: carry on with audio rather than failing the call.
      const stream = await navigator.mediaDevices.getUserMedia({ audio: AUDIO });
      toast("Camera unavailable — continuing with audio only");
      return { stream, video: false };
    }
  }
  return { stream: await navigator.mediaDevices.getUserMedia({ audio: AUDIO }), video: false };
}

async function detectCameras() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((d) => d.kind === "videoinput").length > 1;
  } catch {
    return false;
  }
}

const stopTones = () => {
  stopTone?.();
  stopTone = null;
};

async function drainRemote() {
  const queued = remoteQueue.splice(0);
  for (const candidate of queued) await pc?.addIceCandidate(candidate).catch(() => {});
}

export const useCallStore = create((set, get) => ({
  ...INITIAL,

  _peer: async () => {
    const connection = new RTCPeerConnection({ iceServers: await getIceServers(), iceCandidatePoolSize: 4 });
    connection.onicecandidate = (e) => {
      if (!e.candidate) return;
      const candidate = e.candidate.toJSON();
      const callId = get().callId;
      if (callId) socket()?.emit("call:signal", { callId, candidate });
      else localQueue.push(candidate);
    };
    connection.ontrack = (e) => {
      const stream = e.streams[0] || new MediaStream([e.track]);
      set({ remoteStream: stream, remoteTracks: stream.getTracks().length });
      e.track.onunmute = () => set({ remoteTracks: stream.getTracks().length });
    };
    const onState = () => {
      const state = connection.connectionState || connection.iceConnectionState;
      set({ connection: state });
      if (state === "connected" || state === "completed") {
        clearTimeout(watchdog);
        clearTimeout(dropTimer);
        stopTones();
        set((s) => ({ status: "active", startedAt: s.startedAt || Date.now() }));
      } else if (state === "disconnected") {
        clearTimeout(dropTimer);
        dropTimer = setTimeout(() => {
          if (pc && !["connected", "completed"].includes(pc.connectionState || pc.iceConnectionState)) {
            toast("The call dropped — connection lost.");
            get().hangUp();
          }
        }, 12000);
      } else if (state === "failed") {
        toast.error("Couldn't connect the call. This network may need a TURN relay.");
        get().hangUp();
      }
    };
    connection.onconnectionstatechange = onState;
    connection.oniceconnectionstatechange = () => {
      if (!("connectionState" in connection)) onState();
    };
    return connection;
  },

  _attachLocal: async (media) => {
    localStream = media.stream;
    cameraTrack = localStream.getVideoTracks()[0] || null;
    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
    set({ localStream, canFlip: cameraTrack ? await detectCameras() : false });
  },

  _watch: () => {
    clearTimeout(watchdog);
    watchdog = setTimeout(() => {
      if (get().status === "connecting") {
        toast.error("The call couldn't connect. Check your connection and try again.");
        get().hangUp();
      }
    }, 30000);
  },

  startCall: async (conversation, peer, type = "voice") => {
    if (get().status !== "idle") return toast.error("You're already in a call.");
    const s = socket();
    if (!s?.connected) return toast.error("You're offline. Reconnect to place a call.");

    set({ ...INITIAL, status: "outgoing", direction: "out", type, peer, conversationId: conversation._id });
    let media;
    try {
      media = await getMedia(type);
    } catch (err) {
      set(INITIAL);
      return toast.error(mediaErrorMessage(err, type === "video"));
    }
    if (get().status !== "outgoing") {
      media.stream.getTracks().forEach((t) => t.stop());
      return; // canceled while the permission prompt was open
    }

    pc = await get()._peer();
    await get()._attachLocal(media);
    const callType = media.video ? "video" : "voice";
    set({ type: callType });
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    stopTone = sounds.ringback();

    s.emit("call:start", { conversationId: conversation._id, type: callType, offer: { type: offer.type, sdp: offer.sdp } }, (res) => {
      if (!res?.ok) {
        const name = firstName(peer?.fullName) || "They";
        const reasons = {
          offline: `${name} is offline. They'll see a missed call.`,
          busy: `${name} is on another call.`,
          blocked: "You can't call this person.",
          already_in_call: "You're already in a call.",
          group_unsupported: "Group calls aren't available yet.",
        };
        get()._cleanup();
        toast(reasons[res?.reason] || "Couldn't start the call.");
        return;
      }
      if (get().status === "idle") {
        s.emit("call:end", { callId: res.callId }); // hung up before the server answered
        return;
      }
      set({ callId: res.callId });
      for (const candidate of localQueue.splice(0)) s.emit("call:signal", { callId: res.callId, candidate });
    });
  },

  onIncoming: ({ callId, conversationId, type, offer, from }) => {
    if (get().status !== "idle") return;
    set({ ...INITIAL, status: "incoming", direction: "in", callId, conversationId, type, offer, peer: from });
    const focus = useAuthStore.getState().authUser?.focus;
    const focusing = focus?.until && new Date(focus.until) > new Date();
    if (!focusing) stopTone = sounds.ringtone();
    if (document.visibilityState !== "visible" && "Notification" in window && Notification.permission === "granted") {
      try {
        const n = new Notification(from?.fullName || "Incoming call", {
          body: `Incoming ${type} call`,
          icon: from?.profilePic || "/icons/icon-192.png",
          tag: `call-${callId}`,
          requireInteraction: true,
        });
        n.onclick = () => {
          window.focus();
          n.close();
        };
      } catch {
        // some browsers only allow notifications from the service worker
      }
    }
  },

  acceptCall: async ({ audioOnly = false } = {}) => {
    const { status, offer, callId, type } = get();
    if (status !== "incoming") return;
    stopTones();
    set({ status: "connecting" });

    let media;
    try {
      media = await getMedia(audioOnly ? "voice" : type);
    } catch (err) {
      toast.error(mediaErrorMessage(err, type === "video"));
      return get().decline();
    }
    if (get().callId !== callId) {
      media.stream.getTracks().forEach((t) => t.stop());
      return;
    }

    pc = await get()._peer();
    await get()._attachLocal(media);
    await pc.setRemoteDescription(offer);
    await drainRemote();
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket()?.emit("call:accept", { callId, answer: { type: answer.type, sdp: answer.sdp } }, (res) => {
      if (!res?.ok) {
        toast("This call is no longer available.");
        get()._cleanup();
      }
    });
    set({ cameraOff: type === "video" && !media.video });
    get()._watch();
  },

  onAccepted: async ({ callId, answer }) => {
    if (callId !== get().callId || !pc) return;
    stopTones();
    set({ status: "connecting" });
    try {
      await pc.setRemoteDescription(answer);
      await drainRemote();
    } catch (err) {
      console.warn("[call] bad answer", err);
    }
    get()._watch();
  },

  onSignal: async ({ callId, candidate }) => {
    if (callId !== get().callId || !candidate) return;
    if (pc?.remoteDescription?.type) await pc.addIceCandidate(candidate).catch(() => {});
    else remoteQueue.push(candidate);
  },

  onRemoteMedia: ({ callId, audio, video, screen }) => {
    if (callId === get().callId) set({ remoteAudio: audio, remoteVideo: video, remoteScreen: screen });
  },

  onTaken: ({ callId }) => {
    if (callId !== get().callId) return;
    get()._cleanup();
    toast("Answered on another device");
  },

  onDeclined: ({ callId }) => {
    if (callId !== get().callId) return;
    const name = firstName(get().peer?.fullName) || "They";
    get()._cleanup();
    sounds.callEnd();
    toast(`${name} declined the call`);
  },

  onEnded: ({ callId, reason }) => {
    if (callId !== get().callId) return;
    const { direction, peer } = get();
    get()._cleanup();
    sounds.callEnd();
    const name = firstName(peer?.fullName) || "them";
    const messages = {
      timeout: direction === "out" ? "No answer" : `Missed call from ${name}`,
      canceled: `Missed call from ${name}`,
      disconnected: "Call ended — connection lost",
      hangup: "Call ended",
    };
    toast(messages[reason] || "Call ended");
  },

  decline: () => {
    const { callId } = get();
    if (callId) socket()?.emit("call:decline", { callId });
    get()._cleanup();
  },

  hangUp: () => {
    const { callId, status } = get();
    if (status === "idle") return;
    if (status === "incoming") return get().decline();
    if (callId) socket()?.emit("call:end", { callId });
    get()._cleanup();
    sounds.callEnd();
  },

  _emitMedia: () => {
    const { callId, muted, cameraOff, screenSharing } = get();
    if (callId) socket()?.emit("call:media", { callId, audio: !muted, video: !cameraOff, screen: screenSharing });
  },

  toggleMute: () => {
    if (!localStream) return;
    const muted = !get().muted;
    localStream.getAudioTracks().forEach((t) => (t.enabled = !muted));
    set({ muted });
    get()._emitMedia();
  },

  toggleCamera: () => {
    if (!cameraTrack) return;
    const cameraOff = !get().cameraOff;
    cameraTrack.enabled = !cameraOff;
    set({ cameraOff });
    get()._emitMedia();
  },

  flipCamera: async () => {
    if (!cameraTrack || !pc) return;
    const facing = get().facing === "user" ? "environment" : "user";
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { exact: facing } } });
      const next = stream.getVideoTracks()[0];
      const sender = pc.getSenders().find((s) => s.track?.kind === "video");
      await sender?.replaceTrack(next);
      localStream.removeTrack(cameraTrack);
      cameraTrack.stop();
      localStream.addTrack(next);
      cameraTrack = next;
      next.enabled = !get().cameraOff;
      set({ facing, localStream: new MediaStream(localStream.getTracks()) });
    } catch {
      toast.error("Couldn't switch camera");
    }
  },

  toggleScreenShare: async () => {
    if (!pc) return;
    const sender = pc.getSenders().find((s) => s.track?.kind === "video" || s.track === null);
    if (!sender) return toast("Screen sharing works in video calls.");
    if (get().screenSharing) {
      await sender.replaceTrack(cameraTrack).catch(() => {});
      screenTrack?.stop();
      screenTrack = null;
      set({ screenSharing: false });
      get()._emitMedia();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 15 }, audio: false });
      screenTrack = stream.getVideoTracks()[0];
      screenTrack.onended = () => {
        if (get().screenSharing) get().toggleScreenShare();
      };
      await sender.replaceTrack(screenTrack);
      set({ screenSharing: true });
      get()._emitMedia();
    } catch {
      // user canceled the picker
    }
  },

  setMinimized: (minimized) => set({ minimized }),

  /** After a socket reconnect, re-attach to the ongoing call. */
  rejoin: () => {
    const { callId, status } = get();
    if (!callId || status === "idle") return;
    socket()?.emit("call:rejoin", { callId }, (res) => {
      if (!res?.ok && get().callId === callId) {
        get()._cleanup();
        toast("Call ended");
      }
    });
  },

  _cleanup: () => {
    stopTones();
    clearTimeout(watchdog);
    clearTimeout(dropTimer);
    localStream?.getTracks().forEach((t) => t.stop());
    screenTrack?.stop();
    if (pc) {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.onconnectionstatechange = null;
      pc.oniceconnectionstatechange = null;
      pc.close();
    }
    pc = null;
    localStream = null;
    cameraTrack = null;
    screenTrack = null;
    remoteQueue = [];
    localQueue = [];
    set(INITIAL);
  },

  reset: () => get()._cleanup(),
}));
