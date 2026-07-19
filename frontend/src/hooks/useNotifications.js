import { useChatStore } from "../store/useChatStore";

/**
 * Builds the list of "unread conversation" notifications shown in the
 * bell dropdown, plus a helper to mark them all as read. Shared by the
 * desktop sidebar and the mobile bottom nav so both stay in sync.
 */
export const useNotifications = () => {
  const totalUnread = useChatStore((s) => s.getTotalUnread());
  const unreadCounts = useChatStore((s) => s.unreadCounts);
  const lastMessages = useChatStore((s) => s.lastMessages);
  const users = useChatStore((s) => s.users);
  const setSelectedUser = useChatStore((s) => s.setSelectedUser);

  const notifications = Object.entries(unreadCounts)
    .filter(([, count]) => count > 0)
    .map(([userId, count]) => ({
      user: users.find((u) => u._id === userId),
      count,
      lastMessage: lastMessages[userId],
    }))
    .filter((n) => n.user)
    .sort((a, b) => new Date(b.lastMessage?.createdAt || 0) - new Date(a.lastMessage?.createdAt || 0));

  const markAllAsRead = () => {
    notifications.forEach(({ user }) => {
      useChatStore.setState((state) => ({
        unreadCounts: { ...state.unreadCounts, [user._id]: 0 },
      }));
    });
  };

  const openNotification = (user) => {
    setSelectedUser(user);
  };

  return { totalUnread, notifications, markAllAsRead, openNotification };
};
