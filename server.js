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
const SPAM_DELAY = 5000;
const BAD_WORDS = ["anjing","bangsat","kontol","memek","goblok"];

/* =========================
   DATA
========================= */
let messages = [];
let lastMessageTime = {};

/* =========================
   UTIL
========================= */
function filter(text){
  let r = text;
  BAD_WORDS.forEach(w=>{
    r = r.replace(new RegExp(w,"gi"),"****");
  });
  return r;
}

/* =========================
   SOCKET
========================= */
io.on("connection",(socket)=>{

  // kirim pesan approved saat load display
  socket.emit(
    "refresh-messages",
    messages.filter(m=>m.approved)
  );

  /* ===== CUSTOMER ===== */
  socket.on("send-message",(data)=>{
    const { username, message } = data;
    if(!username || !message) return;

    const now = Date.now();
    if(lastMessageTime[socket.id] &&
       now - lastMessageTime[socket.id] < SPAM_DELAY){
      socket.emit("spam-warning","Tunggu sebentar");
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

    // update admin
    io.emit("admin-refresh", messages);
  });

  /* ===== ADMIN LOGIN ===== */
  socket.on("admin-login",(pass)=>{
    if(pass === ADMIN_PASSWORD){
      socket.isAdmin = true;
      socket.emit("login-success");
      socket.emit("admin-refresh", messages);
    }else{
      socket.emit("login-failed");
    }
  });

  /* ===== ADMIN ACTION ===== */
  socket.on("approve-message",(id)=>{
  if(!socket.isAdmin) return;

  const msg = messages.find(m=>m.id===id);
  if(msg){
    msg.approved = true;
  }

  io.emit(
    "refresh-messages",
    messages.filter(m=>m.approved)
  );

  io.emit("admin-refresh", messages);
});


  socket.on("reject-message",(id)=>{
  if(!socket.isAdmin) return;

  messages = messages.filter(m=>m.id!==id);

  io.emit(
    "refresh-messages",
    messages.filter(m=>m.approved)
  );

  io.emit("admin-refresh", messages);
});


  socket.on("approve-all",()=>{
  if(!socket.isAdmin) return;

  messages.forEach(m=>{
    m.approved = true;
  });

  // kirim ulang SEMUA pesan approved SEKALI
  io.emit(
    "refresh-messages",
    messages.filter(m=>m.approved)
  );

  io.emit("admin-refresh", messages);
});


});

/* =========================
   START
========================= */
server.listen(PORT,()=>{
  console.log("CAFÉ LIVE CHAT READY");
  console.log("PORT:", PORT);
});
