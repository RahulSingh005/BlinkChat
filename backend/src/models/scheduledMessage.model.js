import mongoose from "mongoose";

const { ObjectId, Mixed } = mongoose.Schema.Types;

// Messages queued with "Send later" / "Send at their morning". They only
// become real messages when the scheduler delivers them.
const scheduledMessageSchema = new mongoose.Schema(
  {
    conversation: { type: ObjectId, ref: "Conversation", required: true },
    sender: { type: ObjectId, ref: "User", required: true },
    text: { type: String, default: "", maxlength: 4000 },
    attachments: { type: [Mixed], default: [] },
    replyTo: { type: ObjectId, ref: "Message", default: null },
    urgent: { type: Boolean, default: false },
    sendAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ["pending", "sent", "failed", "canceled"],
      default: "pending",
    },
    lockedAt: { type: Date, default: null },
    attempts: { type: Number, default: 0 },
    error: { type: String, default: "" },
    message: { type: ObjectId, ref: "Message", default: null },
  },
  { timestamps: true }
);

scheduledMessageSchema.index({ status: 1, sendAt: 1 });
scheduledMessageSchema.index({ sender: 1, conversation: 1, status: 1 });

const ScheduledMessage = mongoose.model("ScheduledMessage", scheduledMessageSchema);

export default ScheduledMessage;
