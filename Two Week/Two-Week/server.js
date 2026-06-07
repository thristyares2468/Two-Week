const path = require("path");
const http = require("http");
const express = require("express");
const { Server } = require("socket.io");
const { attachGameServer } = require("./server/gameServer");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  transports: ["polling", "websocket"],
  allowUpgrades: true,
  pingInterval: 25000,
  pingTimeout: 20000,
  maxHttpBufferSize: 1e6
});

io.engine.on("connection_error", (error) => {
  console.error("Socket.IO connection error", {
    code: error.code,
    message: error.message,
    context: error.context
  });
});

const publicPath = path.join(__dirname, "public");
app.use(express.static(publicPath));

app.get("/health", (_req, res) => {
  res.json({ ok: true, game: "Two Weeks" });
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(publicPath, "index.html"));
});

attachGameServer(io);

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`Two Weeks server listening on port ${port}`);
});
