import { create } from "zustand";
import { axiosInstance } from "../lib/axios.js";
import toast from "react-hot-toast";
import { io } from "socket.io-client";

const BASE_URL = import.meta.env.MODE === "development" ? "http://localhost:5001" : "/";

export const useAuthStore = create((set, get) => ({  
    authUser: null,
    isSigningUp: false,
    isLoggingIn: false,
    isUpdatingProfile: false,
    isCheckingAuth: true,
    isGoogleAuthing: false,
    isSendingOtp: false,
    isVerifyingOtp: false,
    isResettingPassword: false,
    onlineUsers: [],
    socket: null,

    checkAuth: async () => {
        try{
            const res = await axiosInstance.get("/auth/check");

            set ({authUser: res.data })
            get().connectSocket();
        }catch(error){
            console.log("Error in checkAuth", error);
            set({authUser: null})
        }
        finally{
            set ({isCheckingAuth: false})
        }
    },   

    signup: async (data) => {
        set({ isSigningUp: true });
        try {
          const res = await axiosInstance.post("/auth/signup", data);
          set({ authUser: res.data });
          toast.success("Account created successfully");
          get().connectSocket();
        } catch (error) {
          toast.error(error.response.data.message);
        } finally {
          set({ isSigningUp: false });
        }
      },
    
    login: async (data) => {
      set({ isLoggingIn: true });
      try {
        const res = await axiosInstance.post("/auth/login", data);
        set({ authUser: res.data });
        toast.success("Logged in successfully");

        get().connectSocket();
      } catch (error) {
        toast.error(error.response.data.message);
      } finally {
        set({ isLoggingIn: false });
      }
    },

    logout: async () => {
      try {
        await axiosInstance.post("/auth/logout");
        set({ authUser: null });
        toast.success("Logged out successfully");
        get().disconnectSocket();
      } catch (error) {
        toast.error(error.response.data.message);
      }
    },

    updateProfile: async (data) => {
      set({ isUpdatingProfile: true });
      try {
        const res = await axiosInstance.put("/auth/update-profile", data);
        set({ authUser: res.data });
        toast.success("Profile updated successfully");
      } catch (error) {
        console.log("error in update profile:", error);
        toast.error(error.response.data.message);
      } finally {
        set({ isUpdatingProfile: false });
      }
    },

    googleAuth: async (credential) => {
      set({ isGoogleAuthing: true });
      try {
        const res = await axiosInstance.post("/auth/google", { credential });
        set({ authUser: res.data });
        toast.success("Signed in with Google");
        get().connectSocket();
        return true;
      } catch (error) {
        toast.error(error.response?.data?.message || "Google sign-in failed");
        return false;
      } finally {
        set({ isGoogleAuthing: false });
      }
    },

    forgotPassword: async (email) => {
      set({ isSendingOtp: true });
      try {
        const res = await axiosInstance.post("/auth/forgot-password", { email });
        toast.success(res.data.message || "Verification code sent");
        return true;
      } catch (error) {
        toast.error(error.response?.data?.message || "Couldn't send verification code");
        return false;
      } finally {
        set({ isSendingOtp: false });
      }
    },

    verifyResetOtp: async (email, otp) => {
      set({ isVerifyingOtp: true });
      try {
        await axiosInstance.post("/auth/verify-reset-otp", { email, otp });
        return true;
      } catch (error) {
        toast.error(error.response?.data?.message || "Invalid code");
        return false;
      } finally {
        set({ isVerifyingOtp: false });
      }
    },

    resetPassword: async (email, newPassword) => {
      set({ isResettingPassword: true });
      try {
        const res = await axiosInstance.post("/auth/reset-password", { email, newPassword });
        toast.success(res.data.message || "Password reset successfully");
        return true;
      } catch (error) {
        toast.error(error.response?.data?.message || "Couldn't reset password");
        return false;
      } finally {
        set({ isResettingPassword: false });
      }
    },

    connectSocket: () => {
      const { authUser } = get();
      if (!authUser || get().socket?.connected) return;

      const socket = io(BASE_URL, {
        query: {
          userId: authUser._id,
        },
      });
      socket.connect();

      set({ socket: socket });

      socket.on("getOnlineUsers", (userIds) => {
        set({ onlineUsers: userIds });
      });
    },

    disconnectSocket: () => {
      if (get().socket?.connected) get().socket.disconnect();
      set({ socket: null, onlineUsers: [] });
    },

}));

