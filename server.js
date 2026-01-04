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
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const SPAM_DELAY = 5000;          // 5 detik
const MESSAGE_LIFETIME = 15000;   // 15 detik tampil di videotron
const BAD_WORDS = ["anjing","bangsat","kontol","memek","goblok"];

/* =========================
   DATA
========================= */
let messages = [];
let lastMessageTime = {};

/* =========================
   UTIL
========================= */
function filterKataKasar(text){
  let result = text;
  BAD_WORDS.forEach(w=>{
    result = result.replace(new RegExp(w,"gi"),"****");
  });
  return result;
}

/* =========================
   SOCKET
========================= */
io.on("connection",(socket)=>{

  /* ===== KIRIM DATA AWAL ===== */
  socket.emit("refresh-messages", messages.filter(m=>m.approved));

  /* =========================
     CUSTOMER KIRIM PESAN
  ========================= */
  socket.on("send-message",(data)=>{
    const { username, message } = data;
    if(!username || !message) return;

    const now = Date.now();
    if(lastMessageTime[socket.id] &&
       now - lastMessageTime[socket.id] < SPAM_DELAY){
      socket.emit("spam-warning","Tunggu beberapa detik");
      return;
    }
    lastMessageTime[socket.id] = now;

    const msg = {
      id: now,
      username: filterKataKasar(username),
      message: filterKataKasar(message),
      approved: false,
      opacity: 1
    };

    messages.push(msg);

    // UPDATE ADMIN
    io.emit("admin-refresh", messages);

    // DISPLAY hanya approved
    io.emit("refresh-messages", messages.filter(m=>m.approved));

    // auto hapus
    setTimeout(()=>{
      messages = messages.filter(m=>m.id !== msg.id);
      io.emit("admin-refresh", messages);
      io.emit("refresh-messages", messages.filter(m=>m.approved));
    }, MESSAGE_LIFETIME);
  });

  /* =========================
     ADMIN LOGIN
  ========================= */
  socket.on("admin-login",(password)=>{
    if(password === ADMIN_PASSWORD){
      socket.isAdmin = true;
      socket.emit("login-success");
      socket.emit("admin-refresh", messages);
      console.log("ADMIN LOGIN SUCCESS");
    }else{
      socket.emit("login-failed");
      console.log("ADMIN LOGIN FAILED");
    }
  });

  socket.on("admin-logout",()=>{
    socket.isAdmin = false;
  });

  /* =========================
     ADMIN ACTION
  ========================= */
  socket.on("approve-message",(id)=>{
    if(!socket.isAdmin) return;

    const msg = messages.find(m=>m.id===id);
    if(msg) msg.approved = true;

    io.emit("admin-refresh", messages);
    io.emit("refresh-messages", messages.filter(m=>m.approved));
  });

  socket.on("reject-message",(id)=>{
    if(!socket.isAdmin) return;

    messages = messages.filter(m=>m.id!==id);
    io.emit("admin-refresh", messages);
    io.emit("refresh-messages", messages.filter(m=>m.approved));
  });

  socket.on("approve-all",()=>{
    if(!socket.isAdmin) return;

    messages.forEach(m=>m.approved=true);
    io.emit("admin-refresh", messages);
    io.emit("refresh-messages", messages);
  });

  socket.on("set-opacity",(data)=>{
    if(!socket.isAdmin) return;

    const msg = messages.find(m=>m.id===data.id);
    if(msg) msg.opacity = data.opacity;

    io.emit("admin-refresh", messages);
    io.emit("refresh-messages", messages.filter(m=>m.approved));
  });

});

/* =========================
   START SERVER
========================= */
server.listen(PORT,()=>{
  console.log("CAFÉ LIVE CHAT READY");
  console.log("Running on port", PORT);
});
