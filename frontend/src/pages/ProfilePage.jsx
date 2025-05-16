import { useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { Camera, Mail, User, Loader2, CheckCircle2 } from "lucide-react";

const formatDate = (isoDate) => {
  if (!isoDate) return "-";
  const date = new Date(isoDate);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const ProfilePage = () => {
  const { authUser, isUpdatingProfile, updateProfile } = useAuthStore();
  const [selectedImg, setSelectedImg] = useState(null);
  const [editName, setEditName] = useState(false);
  const [fullName, setFullName] = useState(authUser?.fullName || "");
  const [successMsg, setSuccessMsg] = useState("");

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = async () => {
      const base64Image = reader.result;
      setSelectedImg(base64Image);
      await updateProfile({ profilePic: base64Image });
      setSuccessMsg("Profile photo updated!");
      setTimeout(() => setSuccessMsg(""), 2000);
    };
  };

  const handleNameSave = async () => {
    if (fullName && fullName !== authUser.fullName) {
      await updateProfile({ fullName });
      setSuccessMsg("Name updated!");
      setTimeout(() => setSuccessMsg(""), 2000);
    }
    setEditName(false);
  };

  return (
    <div className="min-h-screen pt-20 bg-gradient-to-br from-base-200 via-base-100 to-base-300">
      <div className="max-w-2xl mx-auto p-4 py-8">
        <div className="bg-base-100 rounded-2xl shadow-xl p-8 space-y-10">
          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold">Your Profile</h1>
            <p className="text-base-content/60">Manage your BlinkChat account info</p>
          </div>

          {/* Avatar Upload */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative group">
              <img
                src={selectedImg || authUser.profilePic || "/avatar.png"}
                alt="Profile"
                className="size-32 rounded-full object-cover border-4 border-primary/20 shadow-md"
              />
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
                  <Loader2 className="w-5 h-5 text-base-100 animate-spin" />
                ) : (
                  <Camera className="w-5 h-5 text-base-100" />
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
                <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-success/90 text-base-100 px-3 py-1 rounded-full text-xs flex items-center gap-1 shadow">
                  <CheckCircle2 className="w-4 h-4" /> {successMsg}
                </span>
              )}
            </div>
            <p className="text-sm text-zinc-400">
              {isUpdatingProfile ? "Uploading..." : "Click the camera icon to update your photo"}
            </p>
          </div>

          {/* Profile Info */}
          <div className="space-y-6">
            {/* Editable Name */}
            <div className="space-y-1.5">
              <div className="text-sm text-zinc-400 flex items-center gap-2">
                <User className="w-4 h-4" />
                Full Name
                {!editName && (
                  <button
                    className="ml-2 text-primary underline text-xs"
                    onClick={() => setEditName(true)}
                    tabIndex={0}
                  >
                    Edit
                  </button>
                )}
              </div>
              {editName ? (
                <div className="flex gap-2">
                  <input
                    className="input input-bordered flex-1"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleNameSave();
                      if (e.key === "Escape") setEditName(false);
                    }}
                  />
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={handleNameSave}
                    disabled={isUpdatingProfile}
                  >
                    Save
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setEditName(false);
                      setFullName(authUser.fullName);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <p className="px-4 py-2.5 bg-base-200 rounded-lg border">{authUser?.fullName}</p>
              )}
            </div>

            {/* Email (not editable) */}
            <div className="space-y-1.5">
              <div className="text-sm text-zinc-400 flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email Address
              </div>
              <p className="px-4 py-2.5 bg-base-200 rounded-lg border">{authUser?.email}</p>
            </div>
          </div>

          {/* Account Info */}
          <div className="mt-6 bg-base-100 rounded-xl p-6 border border-base-200">
            <h2 className="text-lg font-medium mb-4">Account Information</h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between py-2 border-b border-zinc-200">
                <span>Member Since</span>
                <span>{formatDate(authUser.createdAt)}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span>Account Status</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                  <span className="w-2 h-2 bg-green-500 rounded-full inline-block" />
                  Active
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
