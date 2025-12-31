const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

/* =========================
   KONFIGURASI
========================= */
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = "cafe123";
const SPAM_DELAY = 5000; // 5 detik
const MESSAGE_LIFETIME = 15000; // 15 detik tampil di videotron
const BAD_WORDS = ["anjing", "bangsat", "kontol", "memek", "goblok"];

/* =========================
   DATA STORAGE
========================= */
let messages = [];
let lastMessageTime = {};

/* =========================
   FUNGSI BANTUAN
========================= */
function filterKataKasar(text) {
  let result = text;
  BAD_WORDS.forEach(word => {
    const regex = new RegExp(word, "gi");
    result = result.replace(regex, "****");
  });
  return result;
}

/* =========================
   SOCKET.IO
========================= */
io.on("connection", (socket) => {

  /* Kirim semua pesan ke admin/display */
  socket.emit("refresh-messages", messages);

  /* ===== CUSTOMER KIRIM PESAN ===== */
  socket.on("send-message", (data) => {
    const { username, message } = data;

    if (!username || !message) return;

    // Anti spam
    const now = Date.now();
    if (lastMessageTime[socket.id] &&
        now - lastMessageTime[socket.id] < SPAM_DELAY) {
      socket.emit("spam-warning", "Tunggu beberapa detik sebelum kirim lagi");
      return;
    }
    lastMessageTime[socket.id] = now;

    // Filter kata kasar
    const cleanMessage = filterKataKasar(message);
    const cleanUsername = filterKataKasar(username);

    const msgData = {
      id: now,
      username: cleanUsername,
      message: cleanMessage
    };

    messages.push(msgData);

    // Kirim ke semua client
    io.emit("new-message", msgData);
    io.emit("refresh-messages", messages);

    setTimeout(() => {
  messages = messages.filter(m => m.id !== msgData.id);
  io.emit("refresh-messages", messages);
}, MESSAGE_LIFETIME);
  });

  /* ===== ADMIN LOGIN ===== */
  socket.on("admin-login", (password) => {
    if (password === ADMIN_PASSWORD) {
      socket.emit("login-success");
      socket.emit("refresh-messages", messages);
    } else {
      socket.emit("login-failed");
    }
  });

  /* ===== ADMIN HAPUS PESAN ===== */
  socket.on("delete-message", (id) => {
    messages = messages.filter(m => m.id !== id);
    io.emit("refresh-messages", messages);
  });

  /* ===== ADMIN CLEAR ALL ===== */
  socket.on("clear-messages", () => {
    messages = [];
    io.emit("refresh-messages", messages);
  });

});

/* =========================
   SERVER START
========================= */
server.listen(PORT, () => {
  console.log("CAFÉ LIVE CHAT READY");
  console.log("Server running on port", PORT);
});
