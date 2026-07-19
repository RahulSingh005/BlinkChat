import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import cloudinary from "../lib/cloudinary.js";
import { getReceiverSocketId, io } from "../lib/socket.js";

export const getUsersForSidebar = async (req, res) => {
    try {
      const loggedInUserId = req.user._id;
      const filteredUsers = await User.find({ _id: { $ne: loggedInUserId } }).select(
        "-password -blockedUsers"
      );
  
      res.status(200).json(filteredUsers);
    } catch (error) {
      console.error("Error in getUsersForSidebar: ", error.message);
      res.status(500).json({ error: "Internal server error" });
    }
  };

export const getMessages = async (req, res) => {
    try {
      const { id: userToChatId } = req.params;
      const myId = req.user._id;
  
      const messages = await Message.find({
        $or: [
          { senderId: myId, receiverId: userToChatId },
          { senderId: userToChatId, receiverId: myId },
        ],
      });
  
      res.status(200).json(messages);
    } catch (error) {
      console.log("Error in getMessages controller: ", error.message);
      res.status(500).json({ error: "Internal server error" });
    }
};

export const clearChat = async (req, res) => {
    try {
      const { id: otherUserId } = req.params;
      const myId = req.user._id;

      await Message.deleteMany({
        $or: [
          { senderId: myId, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: myId },
        ],
      });

      res.status(200).json({ message: "Chat cleared" });
    } catch (error) {
      console.log("Error in clearChat controller: ", error.message);
      res.status(500).json({ error: "Internal server error" });
    }
};

export const toggleBlockUser = async (req, res) => {
    try {
      const { id: targetUserId } = req.params;
      const me = req.user;

      if (String(targetUserId) === String(me._id)) {
        return res.status(400).json({ message: "You can't block yourself" });
      }

      const isBlocked = me.blockedUsers?.some((id) => String(id) === String(targetUserId));

      const updatedUser = await User.findByIdAndUpdate(
        me._id,
        isBlocked
          ? { $pull: { blockedUsers: targetUserId } }
          : { $addToSet: { blockedUsers: targetUserId } },
        { new: true }
      ).select("-password");

      res.status(200).json({
        blocked: !isBlocked,
        blockedUsers: updatedUser.blockedUsers,
      });
    } catch (error) {
      console.log("Error in toggleBlockUser controller: ", error.message);
      res.status(500).json({ error: "Internal server error" });
    }
};

export const sendMessage = async (req, res) => {
    try {
        const { text, image } = req.body;
        const { id: receiverId } = req.params;
        const senderId = req.user._id;

        const receiver = await User.findById(receiverId);
        if (receiver?.blockedUsers?.some((id) => String(id) === String(senderId))) {
          return res.status(403).json({ message: "You can't message this user" });
        }
        if (req.user.blockedUsers?.some((id) => String(id) === String(receiverId))) {
          return res.status(403).json({ message: "Unblock this user to send a message" });
        }

    let imageUrl;
        if (image) {
          // Upload base64 image to cloudinary
          const uploadResponse = await cloudinary.uploader.upload(image);
          imageUrl = uploadResponse.secure_url;
    }
    
    const newMessage = new Message({
        senderId,
        receiverId,
        text,
        image: imageUrl,
    });

    await newMessage.save();

    // real time functionality with socket io
    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", newMessage);
    }



    res.status(201).json(newMessage);

    } catch (error) {
    console.log("Error in sendMessage controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
}