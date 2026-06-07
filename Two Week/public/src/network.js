export class NetworkClient extends EventTarget {
  constructor() {
    super();
    this.socket = typeof io === "function" ? io() : null;
    this.connected = false;
    this.id = null;
    this.lastPing = 0;
    this.lastPongAt = performance.now();
    if (this.socket) {
      this.bind();
    } else {
      window.setTimeout(() => {
        this.emitLocal("connection", {
          connected: false,
          reason: "Socket.IO is unavailable. Open the game from the Node server for online multiplayer."
        });
      }, 0);
    }
  }

  bind() {
    this.socket.on("connect", () => {
      this.connected = true;
      this.id = this.socket.id;
      this.emitLocal("connection", { connected: true, id: this.id });
    });

    this.socket.on("disconnect", (reason) => {
      this.connected = false;
      this.emitLocal("connection", { connected: false, reason });
    });

    this.socket.io.on("reconnect_attempt", () => {
      this.emitLocal("connection", { connected: false, reconnecting: true });
    });

    this.forward("connection:state", "connection");
    this.forward("room:state", "roomState");
    this.forward("match:countdown", "countdown");
    this.forward("match:start", "matchStart");
    this.forward("world:snapshot", "snapshot");
    this.forward("combat:hit", "combatHit");
    this.forward("combat:elimination", "elimination");
    this.forward("loot:update", "lootUpdate");
    this.forward("build:update", "buildUpdate");
    this.forward("storm:update", "stormUpdate");
    this.forward("match:finished", "matchFinished");
    this.forward("server:error", "error");

    setInterval(() => {
      if (!this.connected) return;
      const start = performance.now();
      this.socket.timeout(2500).emit("net:ping", () => {
        this.lastPing = Math.round(performance.now() - start);
        this.lastPongAt = performance.now();
        this.emitLocal("ping", { ping: this.lastPing });
      });
    }, 3000);
  }

  forward(socketEvent, localEvent) {
    this.socket.on(socketEvent, (payload) => {
      this.emitLocal(localEvent, payload);
    });
  }

  emitLocal(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }

  createProfile(name) {
    this.send("player:create", { name });
  }

  quickMatch() {
    this.send("room:quickMatch");
  }

  createPrivate() {
    this.send("room:createPrivate");
  }

  joinRoom(roomCode) {
    this.send("room:join", { roomCode });
  }

  practice() {
    this.send("room:practice");
  }

  sandbox() {
    this.send("room:sandbox");
  }

  botLobby() {
    this.send("room:botLobby");
  }

  leaveRoom() {
    this.send("room:leave");
  }

  startMatch() {
    this.send("match:start");
  }

  sendInput(input) {
    this.send("player:input", input);
  }

  selectSlot(slot) {
    this.send("inventory:select", { slot });
  }

  fire(payload) {
    this.send("combat:fire", payload);
  }

  reload() {
    this.send("combat:reload");
  }

  pickup(lootId) {
    this.send("loot:pickup", { lootId });
  }

  placeBuild(piece) {
    this.send("build:place", piece);
  }

  damageBuild(buildId) {
    this.send("build:damage", { buildId });
  }

  useItem() {
    this.send("item:use");
  }

  respawnPractice() {
    this.send("player:respawnPractice");
  }

  send(event, payload) {
    if (!this.socket) {
      this.emitLocal("error", "Online multiplayer requires the Node server to be running.");
      return;
    }
    if (!this.connected) {
      this.emitLocal("error", "Still connecting to the game server. Try again in a moment.");
      return;
    }
    this.socket.emit(event, payload);
  }
}
