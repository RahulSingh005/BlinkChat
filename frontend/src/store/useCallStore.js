import { create } from "zustand";
import toast from "react-hot-toast";
import { useAuthStore } from "./useAuthStore";

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

let peerConnection = null;
let localStream = null;

const cleanupMedia = () => {
  if (localStream) {
    localStream.getTracks().forEach((t) => t.stop());
    localStream = null;
  }
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
};

export const useCallStore = create((set, get) => ({
  // idle | outgoing | incoming | active
  callStatus: "idle",
  callType: "voice", // voice | video
  peer: null, // the other user's profile
  incomingOffer: null,
  localStream: null,
  remoteStream: null,
  isMuted: false,
  isCameraOff: false,
  callStartedAt: null,
  errorMsg: null,

  _getSocket: () => useAuthStore.getState().socket,

  setupCallListeners: () => {
    const socket = get()._getSocket();
    if (!socket) return;

    socket.off("call:incoming");
    socket.off("call:answered");
    socket.off("call:ice-candidate");
    socket.off("call:rejected");
    socket.off("call:ended");
    socket.off("call:unavailable");

    socket.on("call:incoming", ({ callerId, callType, caller, offer }) => {
      // Auto-reject if already on a call
      if (get().callStatus !== "idle") {
        socket.emit("call:reject", { receiverId: callerId });
        return;
      }
      set({
        callStatus: "incoming",
        callType,
        peer: caller || { _id: callerId, fullName: "Unknown" },
        incomingOffer: offer,
      });
    });

    socket.on("call:answered", async ({ answer }) => {
      try {
        if (peerConnection && !peerConnection.currentRemoteDescription) {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        }
        set({ callStatus: "active", callStartedAt: Date.now() });
      } catch (err) {
        console.error("Error setting remote description", err);
      }
    });

    socket.on("call:ice-candidate", async ({ candidate }) => {
      try {
        if (peerConnection && candidate) {
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (err) {
        console.error("Error adding ICE candidate", err);
      }
    });

    socket.on("call:rejected", () => {
      toast.error("Call declined");
      get().endCall(false);
    });

    socket.on("call:ended", () => {
      toast("Call ended", { icon: "📞" });
      get().endCall(false);
    });

    socket.on("call:unavailable", () => {
      toast.error("User is offline");
      get().endCall(false);
    });
  },

  teardownCallListeners: () => {
    const socket = get()._getSocket();
    if (!socket) return;
    ["call:incoming", "call:answered", "call:ice-candidate", "call:rejected", "call:ended", "call:unavailable"].forEach(
      (evt) => socket.off(evt)
    );
  },

  _createPeerConnection: (receiverId) => {
    const socket = get()._getSocket();
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket?.emit("call:ice-candidate", { receiverId, candidate: event.candidate });
      }
    };

    pc.ontrack = (event) => {
      set({ remoteStream: event.streams[0] });
    };

    pc.onconnectionstatechange = () => {
      if (["disconnected", "failed", "closed"].includes(pc.connectionState)) {
        // let explicit end handlers manage state transitions
      }
    };

    return pc;
  },

  startCall: async (targetUser, callType = "voice") => {
    const socket = get()._getSocket();
    if (!socket) return toast.error("Not connected");

    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === "video",
      });
    } catch (err) {
      toast.error("Could not access camera/microphone");
      return;
    }

    set({
      callStatus: "outgoing",
      callType,
      peer: targetUser,
      localStream,
      remoteStream: null,
      isMuted: false,
      isCameraOff: false,
    });

    peerConnection = get()._createPeerConnection(targetUser._id);
    localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream));

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    const authUser = useAuthStore.getState().authUser;
    socket.emit("call:invite", {
      receiverId: targetUser._id,
      callType,
      offer,
      caller: {
        _id: authUser._id,
        fullName: authUser.fullName,
        profilePic: authUser.profilePic,
      },
    });
  },

  acceptCall: async () => {
    const { peer, incomingOffer, callType } = get();
    const socket = get()._getSocket();
    if (!socket || !peer || !incomingOffer) return;

    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === "video",
      });
    } catch (err) {
      toast.error("Could not access camera/microphone");
      get().rejectCall();
      return;
    }

    set({ localStream, remoteStream: null });

    peerConnection = get()._createPeerConnection(peer._id);
    localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream));

    await peerConnection.setRemoteDescription(new RTCSessionDescription(incomingOffer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    socket.emit("call:answer", { receiverId: peer._id, answer });
    set({ callStatus: "active", callStartedAt: Date.now() });
  },

  rejectCall: () => {
    const { peer } = get();
    const socket = get()._getSocket();
    if (peer) socket?.emit("call:reject", { receiverId: peer._id });
    get().endCall(false);
  },

  toggleMute: () => {
    if (!localStream) return;
    const enabled = !get().isMuted;
    localStream.getAudioTracks().forEach((t) => (t.enabled = !enabled));
    set({ isMuted: enabled });
  },

  toggleCamera: () => {
    if (!localStream) return;
    const off = !get().isCameraOff;
    localStream.getVideoTracks().forEach((t) => (t.enabled = !off));
    set({ isCameraOff: off });
  },

  endCall: (notifyPeer = true) => {
    const { peer } = get();
    const socket = get()._getSocket();
    if (notifyPeer && peer && socket) {
      socket.emit("call:end", { receiverId: peer._id });
    }
    cleanupMedia();
    set({
      callStatus: "idle",
      peer: null,
      incomingOffer: null,
      localStream: null,
      remoteStream: null,
      isMuted: false,
      isCameraOff: false,
      callStartedAt: null,
    });
  },
}));
