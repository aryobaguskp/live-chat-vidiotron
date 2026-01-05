const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

let messages = [];
let lastMessageTime = {};
const SPAM_DELAY = 5000;

io.on("connection",(socket)=>{

  // kirim pesan approved saat display load
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

  /* ===== APPROVE SATU ===== */
  socket.on("approve-message",(id)=>{
    if(!socket.isAdmin) return;

    const msg = messages.find(m=>m.id===id);
    if(msg && !msg.approved){
      msg.approved = true;
      io.emit("new-message", msg); // realtime
    }

    io.emit("admin-refresh", messages);
  });

  /* ===== REJECT ===== */
  socket.on("reject-message",(id)=>{
    if(!socket.isAdmin) return;

    messages = messages.filter(m=>m.id!==id);

    io.emit("admin-refresh", messages);
    io.emit("display-refresh", messages.filter(m=>m.approved));
  });

  /* ===== APPROVE ALL (ANTI FREEZE) ===== */
  socket.on("approve-all",()=>{
    if(!socket.isAdmin) return;

    messages.forEach(m=>m.approved = true);

    // refresh display SEKALI
    io.emit("display-refresh", messages.filter(m=>m.approved));
    io.emit("admin-refresh", messages);
  });

});

server.listen(PORT,()=>{
  console.log("CAFÉ LIVE CHAT READY");
  console.log("PORT:", PORT);
});
