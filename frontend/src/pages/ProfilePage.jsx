import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import { formatDate } from "../lib/utils";
import {
  ArrowLeft,
  Camera,
  Mail,
  User,
  Loader2,
  CheckCircle2,
  Phone,
  MessageCircle,
  Pencil,
  Trash2,
  X,
} from "lucide-react";

const ABOUT_PRESETS = [
  "Hey there! I am using BlinkChat.",
  "Available",
  "Busy",
  "At work",
  "Sleeping",
  "Urgent calls only",
];

const EditableField = ({
  icon: Icon,
  label,
  value,
  placeholder,
  maxLength,
  onSave,
  saving,
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || "");

  const handleSave = async () => {
    if (draft.trim() !== (value || "")) {
      await onSave(draft.trim());
    }
    setEditing(false);
  };

  return (
    <div className="space-y-1.5">
      <div className="text-sm text-base-content/60 flex items-center gap-2">
        <Icon className="w-4 h-4" />
        {label}
        {!editing && (
          <button
            className="ml-auto text-primary text-xs flex items-center gap-1 hover:underline"
            onClick={() => {
              setDraft(value || "");
              setEditing(true);
            }}
          >
            <Pencil className="size-3" /> Edit
          </button>
        )}
      </div>
      {editing ? (
        <div className="flex gap-2">
          <input
            className="input input-bordered flex-1"
            value={draft}
            maxLength={maxLength}
            placeholder={placeholder}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") setEditing(false);
            }}
          />
          <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
            Save
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>
            Cancel
          </button>
        </div>
      ) : (
        <p className="px-4 py-2.5 bg-base-200 rounded-lg border border-base-300">
          {value || <span className="text-base-content/40">{placeholder}</span>}
        </p>
      )}
    </div>
  );
};

const ProfilePage = () => {
  const { authUser, isUpdatingProfile, updateProfile } = useAuthStore();
  const [selectedImg, setSelectedImg] = useState(null);
  const [successMsg, setSuccessMsg] = useState("");
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  const [showAboutPresets, setShowAboutPresets] = useState(false);
  const [aboutDraft, setAboutDraft] = useState(authUser?.about || "");

  const saveAbout = async () => {
    if (aboutDraft !== (authUser?.about || "")) {
      await updateProfile({ about: aboutDraft });
    }
  };

  const flashSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 2000);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      flashSuccess("");
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = async () => {
      const base64Image = reader.result;
      setSelectedImg(base64Image);
      await updateProfile({ profilePic: base64Image });
      flashSuccess("Profile photo updated!");
    };
  };

  const handleRemovePhoto = async () => {
    setSelectedImg(null);
    await updateProfile({ removeProfilePic: true });
    flashSuccess("Profile photo removed");
  };

  const currentPhoto = selectedImg || authUser.profilePic || "/avatar.png";

  return (
    <div className="min-h-full w-full bg-gradient-to-br from-base-200 via-base-100 to-base-300 py-8">
      <div className="max-w-2xl mx-auto p-4 py-8">
        <Link
          to="/chat"
          className="inline-flex items-center gap-2 text-sm font-medium text-base-content/60 hover:text-primary transition-colors mb-4"
        >
          <ArrowLeft className="size-4" /> Back to Dashboard
        </Link>

        <div className="bg-base-100 rounded-2xl shadow-xl p-8 space-y-10">
          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold">Your Profile</h1>
            <p className="text-base-content/60">Manage your BlinkChat account info</p>
          </div>

          {/* Avatar Upload */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative group">
              <button
                type="button"
                onClick={() => setShowPhotoViewer(true)}
                className="block rounded-full focus:outline-none focus:ring-4 focus:ring-primary/30"
                aria-label="View profile photo"
              >
                <img
                  src={currentPhoto}
                  alt="Profile"
                  className="size-32 rounded-full object-cover border-4 border-primary/20 shadow-md"
                />
              </button>
              <label
                htmlFor="avatar-upload"
                className={`
                  absolute bottom-0 right-0 bg-primary p-2 rounded-full cursor-pointer
                  shadow-lg border-2 border-base-100 transition-all duration-200
                  group-hover:scale-110
                  ${isUpdatingProfile ? "animate-pulse pointer-events-none opacity-70" : ""}
                `}
                aria-label="Change profile photo"
                tabIndex={0}
              >
                {isUpdatingProfile ? (
                  <Loader2 className="w-5 h-5 text-primary-content animate-spin" />
                ) : (
                  <Camera className="w-5 h-5 text-primary-content" />
                )}
                <input
                  type="file"
                  id="avatar-upload"
                  className="hidden"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={isUpdatingProfile}
                  aria-disabled={isUpdatingProfile}
                />
              </label>
              {successMsg && (
                <span className="absolute -bottom-9 left-1/2 -translate-x-1/2 bg-success/90 text-success-content px-3 py-1 rounded-full text-xs flex items-center gap-1 shadow whitespace-nowrap">
                  <CheckCircle2 className="w-4 h-4" /> {successMsg}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <p className="text-sm text-base-content/50">
                {isUpdatingProfile ? "Uploading..." : "Tap photo to change or view"}
              </p>
              {authUser.profilePic && (
                <button
                  onClick={handleRemovePhoto}
                  className="text-xs text-error flex items-center gap-1 hover:underline"
                  disabled={isUpdatingProfile}
                >
                  <Trash2 className="size-3" /> Remove
                </button>
              )}
            </div>
          </div>

          {/* Profile Info */}
          <div className="space-y-6">
            <EditableField
              icon={User}
              label="Full Name"
              value={authUser?.fullName}
              placeholder="Add your name"
              maxLength={50}
              saving={isUpdatingProfile}
              onSave={(val) => val && updateProfile({ fullName: val })}
            />

            {/* About */}
            <div className="space-y-1.5 relative">
              <div className="text-sm text-base-content/60 flex items-center gap-2">
                <MessageCircle className="w-4 h-4" />
                About
              </div>
              <div className="relative">
                <input
                  className="input input-bordered w-full pr-16"
                  value={aboutDraft}
                  maxLength={150}
                  placeholder="Add a status message"
                  onFocus={() => setShowAboutPresets(true)}
                  onChange={(e) => setAboutDraft(e.target.value)}
                  onBlur={() => {
                    saveAbout();
                    setTimeout(() => setShowAboutPresets(false), 150);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-base-content/40">
                  {aboutDraft.length}/150
                </span>
              </div>
              {showAboutPresets && (
                <div className="absolute z-10 mt-1 w-full bg-base-100 border border-base-300 rounded-xl shadow-lg overflow-hidden">
                  {ABOUT_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      className="w-full text-left px-4 py-2 text-sm hover:bg-primary/10"
                      onMouseDown={() => {
                        setAboutDraft(preset);
                        updateProfile({ about: preset });
                        setShowAboutPresets(false);
                      }}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <EditableField
              icon={Phone}
              label="Phone Number"
              value={authUser?.phone}
              placeholder="Add your phone number"
              maxLength={20}
              saving={isUpdatingProfile}
              onSave={(val) => updateProfile({ phone: val })}
            />

            {/* Email (not editable) */}
            <div className="space-y-1.5">
              <div className="text-sm text-base-content/60 flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email Address
              </div>
              <p className="px-4 py-2.5 bg-base-200 rounded-lg border border-base-300">{authUser?.email}</p>
            </div>
          </div>

          {/* Account Info */}
          <div className="mt-6 bg-base-100 rounded-xl p-6 border border-base-300">
            <h2 className="text-lg font-medium mb-4">Account Information</h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between py-2 border-b border-base-300">
                <span>Member Since</span>
                <span>{formatDate(authUser.createdAt)}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span>Account Status</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-success/15 text-success rounded-full text-xs font-semibold">
                  <span className="w-2 h-2 bg-success rounded-full inline-block" />
                  Active
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Full photo viewer */}
      {showPhotoViewer && (
        <div
          className="fixed inset-0 z-[90] bg-black/85 flex items-center justify-center p-6 animate-fade-in"
          onClick={() => setShowPhotoViewer(false)}
        >
          <button
            className="absolute top-4 right-4 btn btn-circle btn-ghost text-white"
            onClick={() => setShowPhotoViewer(false)}
            aria-label="Close"
          >
            <X className="size-6" />
          </button>
          <img
            src={currentPhoto}
            alt="Profile full size"
            className="max-w-full max-h-full rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
