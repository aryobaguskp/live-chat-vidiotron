const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

// 🔴 PENTING UNTUK RAILWAY
const io = new Server(server, {
  cors: { origin: "*" }
});

app.use(express.static("public"));

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const SPAM_DELAY = 5000;

let messages = [];
let lastMessageTime = {};
let bgOpacity = 0.55; // default opacity background display

io.on("connection",(socket)=>{

  // kirim opacity saat display connect
  socket.emit("bg-opacity", bgOpacity);

  socket.on("set-bg-opacity",(val)=>{
    if(!socket.isAdmin) return;
    bgOpacity = val;
    io.emit("bg-opacity", bgOpacity);
  });

  // kirim pesan approved saat display connect
  socket.emit(
    "refresh-messages",
    messages.filter(m => m.approved)
  );

  /* ===== CUSTOMER ===== */
  socket.on("send-message",(data)=>{
    const { username, message } = data;
    if(!username || !message) return;

    const now = Date.now();
    if(lastMessageTime[socket.id] &&
       now - lastMessageTime[socket.id] < SPAM_DELAY){
      return;
    }
    lastMessageTime[socket.id] = now;

    const msg = {
      id: now,
      username,
      message,
      approved: false
    };

    messages.push(msg);
    io.emit("admin-refresh", messages);
  });

  /* ===== ADMIN LOGIN (JANGAN DIUBAH) ===== */
  socket.on("admin-login",(pass)=>{
    if(pass === ADMIN_PASSWORD){
      socket.isAdmin = true;
      socket.emit("login-success");
      socket.emit("admin-refresh", messages);
    }else{
      socket.emit("login-failed");
    }
  });

  /* ===== APPROVE ===== */
  socket.on("approve-message",(id)=>{
    if(!socket.isAdmin) return;

    const msg = messages.find(m=>m.id === id);
    if(msg && !msg.approved){
      msg.approved = true;
      io.emit("new-message", msg);
    }

    io.emit("admin-refresh", messages);
  });

  /* ===== REJECT ===== */
  socket.on("reject-message",(id)=>{
    if(!socket.isAdmin) return;

    messages = messages.filter(m => m.id !== id);

    io.emit("admin-refresh", messages);
    io.emit(
      "refresh-messages",
      messages.filter(m => m.approved)
    );
  });

  /* ===== DELETE PERMANEN ===== */
  socket.on("delete-message",(id)=>{
    if(!socket.isAdmin) return;

    messages = messages.filter(m => m.id !== id);

    io.emit("admin-refresh", messages);
    io.emit(
      "refresh-messages",
      messages.filter(m => m.approved)
    );
  });

  /* ===== APPROVE ALL (ANTI FREEZE) ===== */
  socket.on("approve-all",()=>{
    if(!socket.isAdmin) return;

    messages.forEach(m => m.approved = true);

    io.emit(
      "refresh-messages",
      messages.filter(m => m.approved)
    );
    io.emit("admin-refresh", messages);
  });

});

server.listen(PORT,()=>{
  console.log("CAFÉ LIVE CHAT READY");
  console.log("PORT:", PORT);
});
