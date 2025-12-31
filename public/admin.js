const socket = io();
const list = document.getElementById("list");

socket.on("all-messages", (msgs) => {
  render(msgs);
});

socket.on("refresh-messages", (msgs) => {
  render(msgs);
});

function render(msgs) {
  list.innerHTML = "";
  msgs.forEach(m => {
    const li = document.createElement("li");
    li.innerHTML = `
      <b>${m.username}</b>: ${m.message}
      <button onclick="hapus(${m.id})">Hapus</button>
    `;
    list.appendChild(li);
  });
}

function hapus(id) {
  socket.emit("delete-message", id);
}

function clearAll() {
  if(confirm("Hapus semua pesan?")) {
    socket.emit("clear-messages");
  }
}
