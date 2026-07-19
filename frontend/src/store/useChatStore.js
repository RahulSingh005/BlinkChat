import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";
import { useThemeStore } from "./useThemeStore";

const showBrowserNotification = (message, sender) => {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  if (document.visibilityState === "visible") return;

  const body = message.image && !message.text ? "📷 Sent a photo" : message.text || "New message";
  const notif = new Notification(sender?.fullName || "New message", {
    body,
    icon: sender?.profilePic || "/avatar.png",
    tag: `blinkchat-${sender?._id || "msg"}`,
  });
  notif.onclick = () => {
    window.focus();
    notif.close();
  };
};

const getChatPartnerId = (message, authUserId) =>
  message.senderId === authUserId ? message.receiverId : message.senderId;

export const useChatStore = create((set, get) => ({
  messages: [],
  users: [],
  selectedUser: null,
  isUsersLoading: false,
  isMessagesLoading: false,
  unreadCounts: {},
  lastMessages: {},
  typingUsers: {},

  getUsers: async () => {
    set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get("/messages/users");
      set({ users: res.data });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load contacts");
    } finally {
      set({ isUsersLoading: false });
    }
  },

  getMessages: async (userId) => {
    set({ isMessagesLoading: true });
    try {
      const res = await axiosInstance.get(`/messages/${userId}`);
      const messages = res.data;
      set({ messages });

      if (messages.length > 0) {
        const lastMsg = messages[messages.length - 1];
        set((state) => ({
          lastMessages: { ...state.lastMessages, [userId]: lastMsg },
        }));
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load messages");
    } finally {
      set({ isMessagesLoading: false });
    }
  },

  sendMessage: async (messageData) => {
    const { selectedUser, messages } = get();
    try {
      const res = await axiosInstance.post(
        `/messages/send/${selectedUser._id}`,
        messageData
      );
      const newMessage = res.data;
      set({
        messages: [...messages, newMessage],
        lastMessages: {
          ...get().lastMessages,
          [selectedUser._id]: newMessage,
        },
      });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to send message");
      throw error;
    }
  },

  setSelectedUser: (selectedUser) => {
    if (selectedUser) {
      set((state) => ({
        selectedUser,
        unreadCounts: { ...state.unreadCounts, [selectedUser._id]: 0 },
        typingUsers: { ...state.typingUsers, [selectedUser._id]: false },
      }));
    } else {
      set({ selectedUser: null });
    }
  },

  emitTyping: (receiverId, isTyping) => {
    const socket = useAuthStore.getState().socket;
    socket?.emit("typing", { receiverId, isTyping });
  },

  setupGlobalListeners: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    socket.off("newMessage");
    socket.on("newMessage", (newMessage) => {
      const { selectedUser } = get();
      const authUserId = useAuthStore.getState().authUser?._id;
      if (!authUserId) return;

      const partnerId = getChatPartnerId(newMessage, authUserId);

      set((state) => ({
        lastMessages: { ...state.lastMessages, [partnerId]: newMessage },
      }));

      const isFromSelectedUser =
        selectedUser && newMessage.senderId === selectedUser._id;

      if (isFromSelectedUser) {
        set({ messages: [...get().messages, newMessage] });
      } else if (newMessage.senderId !== authUserId) {
        set((state) => ({
          unreadCounts: {
            ...state.unreadCounts,
            [newMessage.senderId]:
              (state.unreadCounts[newMessage.senderId] || 0) + 1,
          },
        }));
      }

      if (newMessage.senderId !== authUserId) {
        const { notificationsEnabled, soundEnabled } = useThemeStore.getState();
        const sender = get().users.find((u) => u._id === newMessage.senderId);

        if (notificationsEnabled) {
          showBrowserNotification(newMessage, sender);
        }
        if (soundEnabled && !isFromSelectedUser) {
          // subtle in-app toast as a fallback / supplement to native notification
          toast(`${sender?.fullName || "New message"}: ${
            newMessage.image && !newMessage.text ? "📷 Photo" : newMessage.text || ""
          }`, { icon: "💬" });
        }
      }
    });

    socket.off("userTyping");
    socket.on("userTyping", ({ senderId, isTyping }) => {
      set((state) => ({
        typingUsers: { ...state.typingUsers, [senderId]: isTyping },
      }));
    });
  },

  teardownGlobalListeners: () => {
    const socket = useAuthStore.getState().socket;
    socket?.off("newMessage");
    socket?.off("userTyping");
  },

  getTotalUnread: () => {
    const { unreadCounts } = get();
    return Object.values(unreadCounts).reduce((sum, n) => sum + n, 0);
  },

  clearChatWith: async (userId) => {
    try {
      await axiosInstance.delete(`/messages/clear/${userId}`);
      set((state) => ({
        messages: state.selectedUser?._id === userId ? [] : state.messages,
        lastMessages: { ...state.lastMessages, [userId]: null },
      }));
      toast.success("Chat cleared");
      return true;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to clear chat");
      return false;
    }
  },

  toggleBlockUser: async (userId) => {
    try {
      const res = await axiosInstance.put(`/messages/block/${userId}`);
      useAuthStore.setState((state) => ({
        authUser: state.authUser
          ? { ...state.authUser, blockedUsers: res.data.blockedUsers }
          : state.authUser,
      }));
      toast.success(res.data.blocked ? "User blocked" : "User unblocked");
      return res.data.blocked;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update block status");
      return null;
    }
  },
}));
