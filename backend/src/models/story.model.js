import mongoose from "mongoose";

const { ObjectId } = mongoose.Schema.Types;

export const STORY_TTL_MS = 24 * 60 * 60 * 1000;

// Status updates that disappear after 24 hours (removed by the TTL index).
const storySchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: "User", required: true },
    kind: { type: String, enum: ["text", "image", "video"], required: true },
    text: { type: String, default: "", maxlength: 700 },
    background: { type: String, default: "" },
    font: { type: String, enum: ["sans", "serif", "mono", "display"], default: "sans" },
    media: {
      type: new mongoose.Schema(
        {
          url: String,
          kind: String,
          width: Number,
          height: Number,
          duration: Number,
          publicId: String,
          storage: String,
        },
        { _id: false }
      ),
      default: null,
    },
    caption: { type: String, default: "", maxlength: 300 },
    viewers: {
      type: [
        new mongoose.Schema(
          {
            user: { type: ObjectId, ref: "User", required: true },
            at: { type: Date, default: Date.now },
            reaction: { type: String, default: "" },
            // Viewer has read receipts off: counts for their own "seen"
            // state but isn't shown to the owner (WhatsApp behaviour).
            hidden: { type: Boolean, default: false },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

storySchema.index({ user: 1, createdAt: -1 });
// The scheduler deletes expired stories (and their media) every few
// minutes; the TTL index is only a backstop if it falls behind.
storySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 6 * 3600 });

const Story = mongoose.model("Story", storySchema);

export default Story;
