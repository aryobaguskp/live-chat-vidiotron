const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const PORT = 3000;
const ADMIN_PASSWORD = "admin123";

let messages = [];

io.on("connection",(socket)=>{

  socket.emit(
    "refresh-messages",
    messages.filter(m=>m.approved)
  );

  socket.on("send-message",(data)=>{
    const msg={
      id:Date.now(),
      username:data.username,
      message:data.message,
      approved:false
    };
    messages.push(msg);
    io.emit("admin-refresh",messages);
  });

  socket.on("admin-login",(pass)=>{
    if(pass===ADMIN_PASSWORD){
      socket.isAdmin=true;
      socket.emit("login-success");
      socket.emit("admin-refresh",messages);
    }else{
      socket.emit("login-failed");
    }
  });

  socket.on("approve-message",(id)=>{
    if(!socket.isAdmin) return;
    const m=messages.find(x=>x.id===id);
    if(m) m.approved=true;
    io.emit("refresh-messages",messages.filter(m=>m.approved));
    io.emit("admin-refresh",messages);
  });

  socket.on("reject-message",(id)=>{
    if(!socket.isAdmin) return;
    messages=messages.filter(m=>m.id!==id);
    io.emit("refresh-messages",messages.filter(m=>m.approved));
    io.emit("admin-refresh",messages);
  });

  socket.on("approve-all",()=>{
    if(!socket.isAdmin) return;
    messages.forEach(m=>m.approved=true);
    io.emit("refresh-messages",messages.filter(m=>m.approved));
    io.emit("admin-refresh",messages);
  });
});

server.listen(PORT,()=>{
  console.log("LIVE CHAT READY :",PORT);
});
