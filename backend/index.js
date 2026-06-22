require("dotenv").config();
const http = require("http");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const mongoose = require("mongoose");
const { Server } = require("socket.io");
const { admin } = require("./middleware/auth");

const usersRouter = require("./routes/users");
const postsRouter = require("./routes/posts");
const commentsRouter = require("./routes/comments");
const storiesRouter = require("./routes/stories");
const notificationsRouter = require("./routes/notifications");
const reelsRouter = require("./routes/reels");

const app = express();
const httpServer = http.createServer(app);
const PORT = process.env.PORT || 5000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";

const io = new Server(httpServer, {
  cors: { origin: CLIENT_ORIGIN, methods: ["GET", "POST"] },
});

io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error("Authentication token missing"));
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    socket.uid = decoded.uid;
    next();
  } catch {
    next(new Error("Invalid token"));
  }
});

io.on("connection", (socket) => {

socket.join(socket.uid);
  console.log(`🔌 Socket connected: ${socket.uid}`);
  socket.on("disconnect", () => console.log(`❌ Socket disconnected: ${socket.uid}`));
});

app.io = io;

app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));
app.use(express.json());
app.use(morgan("dev"));

app.get("/", (req, res) => res.json({ status: "Snapgram API running ⚡" }));

app.use("/api/users", usersRouter);
app.use("/api/posts", postsRouter);
app.use("/api/comments", commentsRouter);
app.use("/api/stories", storiesRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/reels", reelsRouter);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || "Internal server error" });
});

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("✅ MongoDB connected");
    httpServer.listen(PORT, () =>
      console.log(`🚀 Server + Socket.IO running on http://localhost:${PORT}`)
    );
  })
  .catch((err) => {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  });

httpServer.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `\n❌ Port ${PORT} is already in use.\n` +
      `   Run this to free it:  Stop-Process -Name "node" -Force\n` +
      `   Then restart:         node index.js\n`
    );
    process.exit(1);
  } else {
    throw err;
  }
});
