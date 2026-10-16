import fs from "node:fs";
import path from "node:path";
import webpush from "web-push";
import { BACKEND_ROOT, env } from "../config/env.js";
import PushSubscription from "../models/pushSubscription.model.js";
import { idStr } from "./utils.js";

let vapid = null;

/**
 * Web Push needs a VAPID key pair. Production should set VAPID_PUBLIC_KEY /
 * VAPID_PRIVATE_KEY (generate with `npm run vapid`). For zero-config local
 * development a pair is generated once and stored in backend/.data/.
 */
export function initPush() {
  if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
    vapid = { publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY };
  } else if (!env.isTest) {
    const file = path.join(BACKEND_ROOT, ".data", "vapid.json");
    try {
      vapid = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      vapid = webpush.generateVAPIDKeys();
      try {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, JSON.stringify(vapid, null, 2));
      } catch (err) {
        console.warn("[push] Could not persist generated VAPID keys:", err.message);
      }
      console.warn(
        "[push] VAPID keys not configured; generated a local pair in backend/.data/vapid.json." +
          (env.isProd ? " Set VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY so subscriptions survive redeploys." : "")
      );
    }
  }
  if (vapid) webpush.setVapidDetails(env.VAPID_SUBJECT, vapid.publicKey, vapid.privateKey);
  return Boolean(vapid);
}

export const pushEnabled = () => Boolean(vapid);
export const vapidPublicKey = () => vapid?.publicKey || null;

/**
 * Sends a notification to every device the user subscribed. Expired
 * subscriptions (404/410) are pruned automatically. Never throws.
 */
export async function sendPushToUser(userId, payload, { ttl = 3600, urgency = "high", topic } = {}) {
  if (!vapid) return 0;
  const subs = await PushSubscription.find({ user: idStr(userId) }).lean();
  if (!subs.length) return 0;

  const body = JSON.stringify(payload);
  let delivered = 0;
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, body, {
          TTL: ttl,
          urgency,
          ...(topic ? { topic: String(topic).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32) } : {}),
        });
        delivered += 1;
      } catch (err) {
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await PushSubscription.deleteOne({ _id: sub._id }).catch(() => {});
        } else if (!env.isTest) {
          console.warn("[push] send failed:", err?.statusCode || "", err?.body || err?.message);
        }
      }
    })
  );
  return delivered;
}
