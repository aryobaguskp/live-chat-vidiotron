const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

/* ================= CONFIG ================= */
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const SPAM_DELAY = 5000;
const MESSAGE_LIFETIME = 15000;
const BAD_WORDS = ["anjing","bangsat","kontol","memek","goblok"];

/* ================= DATA ================= */
let messages = [];
let lastMessageTime = {};

/* ================= HELPER ================= */
function filter(text) {
  BAD_WORDS.forEach(w => {
    text = text.replace(new RegExp(w, "gi"), "****");
  });
  return text;
}

/* ================= SOCKET ================= */
io.on("connection", socket => {

  socket.isAdmin = false;

  socket.emit("refresh-messages", messages.filter(m => m.approved));

  /* ===== CUSTOMER ===== */
  socket.on("send-message", ({ username, message }) => {
    if (!username || !message) return;

    const now = Date.now();
    if (lastMessageTime[socket.id] && now - lastMessageTime[socket.id] < SPAM_DELAY) {
      socket.emit("spam-warning", "Tunggu beberapa detik");
      return;
    }
    lastMessageTime[socket.id] = now;

    const msg = {
      id: now,
      username: filter(username),
      message: filter(message),
      approved: false,
      opacity: 1
    };

    messages.push(msg);
    io.emit("admin-refresh", messages);
  });

  /* ===== ADMIN LOGIN ===== */
  socket.on("admin-login", password => {
    if (password === ADMIN_PASSWORD) {
      socket.isAdmin = true;
      socket.emit("login-success");
      socket.emit("admin-refresh", messages);
    } else {
      socket.emit("login-failed");
    }
  });

  socket.on("admin-logout", () => {
    socket.isAdmin = false;
  });

  /* ===== ADMIN ACTION ===== */
  socket.on("approve-message", id => {
    if (!socket.isAdmin) return;
    const msg = messages.find(m => m.id === id);
    if (!msg) return;

    msg.approved = true;
    io.emit("refresh-messages", messages.filter(m => m.approved));

    setTimeout(() => {
      messages = messages.filter(m => m.id !== id);
      io.emit("refresh-messages", messages.filter(m => m.approved));
      io.emit("admin-refresh", messages);
    }, MESSAGE_LIFETIME);
  });

  socket.on("reject-message", id => {
    if (!socket.isAdmin) return;
    messages = messages.filter(m => m.id !== id);
    io.emit("admin-refresh", messages);
  });

  socket.on("set-opacity", ({ id, opacity }) => {
    if (!socket.isAdmin) return;
    const msg = messages.find(m => m.id === id);
    if (!msg) return;
    msg.opacity = opacity;
    io.emit("refresh-messages", messages.filter(m => m.approved));
  });

});

server.listen(PORT, () => {
  console.log("CAFÉ LIVE CHAT READY");
  console.log("Running on port", PORT);
});
