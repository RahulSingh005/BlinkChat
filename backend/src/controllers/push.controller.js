import PushSubscription from "../models/pushSubscription.model.js";
import { unavailable } from "../lib/errors.js";
import { pushEnabled, sendPushToUser, vapidPublicKey } from "../lib/push.js";

export const getPublicKey = (req, res) => {
  res.json({ enabled: pushEnabled(), publicKey: vapidPublicKey() });
};

export const subscribe = async (req, res) => {
  if (!pushEnabled()) throw unavailable("Push notifications aren't configured on this server");
  const { endpoint, keys } = req.data.subscription;
  await PushSubscription.findOneAndUpdate(
    { endpoint },
    {
      $set: {
        user: req.user._id,
        keys,
        userAgent: String(req.headers["user-agent"] || "").slice(0, 300),
        lastUsedAt: new Date(),
      },
    },
    { upsert: true }
  );
  res.status(201).json({ subscribed: true });
};

export const unsubscribe = async (req, res) => {
  await PushSubscription.deleteOne({ endpoint: req.data.endpoint, user: req.user._id });
  res.json({ unsubscribed: true });
};

export const sendTest = async (req, res) => {
  const delivered = await sendPushToUser(req.user._id, {
    type: "test",
    title: "BlinkChat notifications are on 🎉",
    body: "You'll get notified about new messages even when BlinkChat is closed.",
    tag: "blinkchat-test",
    url: "/settings",
  });
  res.json({ delivered });
};
