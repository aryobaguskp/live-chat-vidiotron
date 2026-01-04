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
  socket.on("send-message", (data) => {
  const { username, message } = data;
  if (!username || !message) return;

  const now = Date.now();
  if (lastMessageTime[socket.id] &&
      now - lastMessageTime[socket.id] < SPAM_DELAY) {
    socket.emit("spam-warning", "Tunggu beberapa detik sebelum kirim lagi");
    return;
  }
  lastMessageTime[socket.id] = now;

  const msgData = {
    id: now,
    username: filterKataKasar(username),
    message: filterKataKasar(message),
    approved: false,
    opacity: 1
  };

  messages.push(msgData);

  // 🔴 ADMIN HARUS UPDATE
  io.emit("admin-refresh", messages);

  // display hanya yg approved
  io.emit("refresh-messages", messages.filter(m => m.approved));

  // realtime ping
  io.emit("new-message", msgData);

  setTimeout(() => {
    messages = messages.filter(m => m.id !== msgData.id);
    io.emit("admin-refresh", messages);
    io.emit("refresh-messages", messages.filter(m => m.approved));
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
