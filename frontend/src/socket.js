import { io } from "socket.io-client";
import { auth } from "./firebase";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

let socket = null;


export async function getSocket() {
  if (socket?.connected) return socket;

  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Not authenticated");

  socket = io(BASE_URL, {
    auth: { token },
    transports: ["websocket"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
  });

  

  socket.on("reconnect_attempt", async () => {
    try {
      const freshToken = await auth.currentUser?.getIdToken(true);
      if (freshToken) socket.auth = { token: freshToken };
    } catch (_) {}
  });

  socket.on("connect", () => console.log("🔌 Socket connected:", socket.id));
  socket.on("disconnect", () => console.log("❌ Socket disconnected"));
  socket.on("connect_error", (err) => console.warn("Socket error:", err.message));

  return socket;
}


export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}


export function getRawSocket() {
  return socket;
}
