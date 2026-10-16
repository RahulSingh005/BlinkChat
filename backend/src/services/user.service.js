import User from "../models/user.model.js";
import { getContactIds } from "../lib/cache.js";
import { emitToUser } from "../lib/realtime.js";
import { publicUser, selfUser } from "../lib/serializers.js";

/**
 * Pushes a profile change (name, photo, status, focus mode, privacy...) to
 * everyone who shares a chat with the user, each with their own privacy-
 * filtered view, plus the user's other devices.
 */
export async function broadcastProfile(user) {
  emitToUser(user._id, "me:updated", { user: selfUser(user) });
  const contactIds = await getContactIds(user._id);
  if (!contactIds.length) return;
  const viewers = await User.find({ _id: { $in: contactIds } })
    .select("_id settings")
    .lean();
  for (const viewer of viewers) {
    emitToUser(viewer._id, "user:updated", { user: publicUser(user, viewer) });
  }
}
