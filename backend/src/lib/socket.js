import { Server } from 'socket.io';
import http from 'http';
import express from 'express';

const app = express();
const server = http.createServer(app);


const allowedOrigins = ["http://localhost:5173", process.env.CLIENT_URL].filter(Boolean);

const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        credentials: true,
    },
})

export function getReceiverSocketId(userId) {
    return userSocketMap[userId];
  }

// used to store online users
const userSocketMap = {}; // {userId: socketId}

io.on('connection', (socket) => {
    console.log("A user connected", socket.id);

    const userId = socket.handshake.query.userId;
    if (userId) userSocketMap[userId] = socket.id;

    // io.emit() is used to send events to all the connected clients
    io.emit("getOnlineUsers", Object.keys(userSocketMap));

    socket.on("typing", ({ receiverId, isTyping }) => {
        const receiverSocketId = userSocketMap[receiverId];
        if (receiverSocketId) {
            io.to(receiverSocketId).emit("userTyping", { senderId: userId, isTyping });
        }
    });

    // ---- WebRTC call signaling ----
    socket.on("call:invite", ({ receiverId, callType, caller, offer }) => {
        const receiverSocketId = userSocketMap[receiverId];
        if (receiverSocketId) {
            io.to(receiverSocketId).emit("call:incoming", {
                callerId: userId,
                callType,
                caller,
                offer,
            });
        } else {
            socket.emit("call:unavailable", { receiverId });
        }
    });

    socket.on("call:answer", ({ receiverId, answer }) => {
        const receiverSocketId = userSocketMap[receiverId];
        if (receiverSocketId) {
            io.to(receiverSocketId).emit("call:answered", { answer, calleeId: userId });
        }
    });

    socket.on("call:ice-candidate", ({ receiverId, candidate }) => {
        const receiverSocketId = userSocketMap[receiverId];
        if (receiverSocketId) {
            io.to(receiverSocketId).emit("call:ice-candidate", { candidate, senderId: userId });
        }
    });

    socket.on("call:reject", ({ receiverId }) => {
        const receiverSocketId = userSocketMap[receiverId];
        if (receiverSocketId) {
            io.to(receiverSocketId).emit("call:rejected", { calleeId: userId });
        }
    });

    socket.on("call:end", ({ receiverId }) => {
        const receiverSocketId = userSocketMap[receiverId];
        if (receiverSocketId) {
            io.to(receiverSocketId).emit("call:ended", { senderId: userId });
        }
    });

    socket.on("disconnect", () => {
        console.log("A user disconnected", socket.id);
        delete userSocketMap[userId];
        io.emit("getOnlineUsers", Object.keys(userSocketMap));
    });
});

export {io, app, server};