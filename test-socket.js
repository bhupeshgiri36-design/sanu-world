import { io } from "socket.io-client";
const socket = io("http://localhost:3000");
socket.on("connect", () => {
  console.log("Connected:", socket.id);
  socket.emit("join-room", { roomCode: "DEMO12", nickname: "Test", password: "" }, (res) => {
    console.log("Response:", res);
    process.exit(0);
  });
});
socket.on("connect_error", (err) => {
  console.log("Error:", err);
  process.exit(1);
});
