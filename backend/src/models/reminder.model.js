import mongoose from "mongoose";

const { ObjectId } = mongoose.Schema.Types;

// "Remind me about this message" — fires a notification at remindAt.
const reminderSchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: "User", required: true },
    conversation: { type: ObjectId, ref: "Conversation", required: true },
    message: { type: ObjectId, ref: "Message", required: true },
    remindAt: { type: Date, required: true },
    note: { type: String, default: "", maxlength: 200 },
    preview: {
      text: { type: String, default: "" },
      senderName: { type: String, default: "" },
    },
    status: {
      type: String,
      enum: ["pending", "fired", "done", "canceled"],
      default: "pending",
    },
    lockedAt: { type: Date, default: null },
    firedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

reminderSchema.index({ status: 1, remindAt: 1 });
reminderSchema.index({ user: 1, status: 1, remindAt: 1 });

const Reminder = mongoose.model("Reminder", reminderSchema);

export default Reminder;
