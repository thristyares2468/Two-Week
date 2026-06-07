import { escapeHtml, formatSeconds } from "./utils.js";
import { getAmmoLabel, getWeaponLabel, WEAPON_STATS } from "./weapons.js";

const MAP_SIZE = 320;
const MAP_POIS = [
  { name: "Rusty Depot", x: -54, z: -42 },
  { name: "Neon Farm", x: 52, z: -54 },
  { name: "Signal Hill", x: -82, z: 50 },
  { name: "Broken Bridge", x: 74, z: 38 },
  { name: "Solar Yard", x: 8, z: -84 },
  { name: "Old Radio Town", x: -8, z: 10 },
  { name: "Quarry Camp", x: 90, z: -12 },
  { name: "Stormwatch Tower", x: -22, z: 82 },
  { name: "Timber Flats", x: 44, z: 78 },
  { name: "Blue Barns", x: -92, z: -10 }
];

export class UIManager {
  constructor(settings) {
    this.settings = settings;
    this.callbacks = {};
    this.room = null;
    this.snapshot = null;
    this.self = null;
    this.lastFps = 0;
    this.lastPing = 0;
    this.mapOpen = false;
    this.elements = this.collect();
    this.bindDom();
    this.renderSettingsModal = this.renderSettingsModal.bind(this);
  }

  collect() {
    const byId = (id) => document.getElementById(id);
    return {
      loading: byId("loadingScreen"),
      menu: byId("menuScreen"),
      room: byId("roomScreen"),
      hud: byId("hud"),
      results: byId("resultsScreen"),
      modal: byId("modalScreen"),
      mapOverlay: byId("mapOverlay"),
      modalContent: byId("modalContent"),
      toastLayer: byId("toastLayer"),
      displayName: byId("displayName"),
      roomCodeInput: byId("roomCodeInput"),
      quickMatch: byId("quickMatchBtn"),
      createPrivate: byId("createPrivateBtn"),
      joinRoom: byId("joinRoomBtn"),
      practice: byId("practiceBtn"),
      botLobby: byId("botLobbyBtn"),
      sandbox: byId("sandboxBtn"),
      settings: byId("settingsBtn"),
      howToPlay: byId("howToPlayBtn"),
      connectionStatus: byId("connectionStatus"),
      roomTypeLabel: byId("roomTypeLabel"),
      roomCodeLabel: byId("roomCodeLabel"),
      roomStatusLabel: byId("roomStatusLabel"),
      playerList: byId("playerList"),
      startMatch: byId("startMatchBtn"),
      leaveRoom: byId("leaveRoomBtn"),
      healthBar: byId("healthBar"),
      shieldBar: byId("shieldBar"),
      healthText: byId("healthText"),
      shieldText: byId("shieldText"),
      matchChip: byId("matchChip"),
      miniMap: byId("miniMap"),
      fullMap: byId("fullMap"),
      mapClose: byId("mapCloseBtn"),
      networkStats: byId("networkStats"),
      hitMarker: byId("hitMarker"),
      buildIndicator: byId("buildIndicator"),
      interactionPrompt: byId("interactionPrompt"),
      inventory: byId("inventory"),
      weaponLabel: byId("weaponLabel"),
      ammoLabel: byId("ammoLabel"),
      materialsLabel: byId("materialsLabel"),
      stormLabel: byId("stormLabel"),
      remainingLabel: byId("remainingLabel"),
      killFeed: byId("killFeed"),
      fpsCounter: byId("fpsCounter"),
      resultTitle: byId("resultTitle"),
      resultStats: byId("resultStats"),
      playAgain: byId("playAgainBtn"),
      returnLobby: byId("returnLobbyBtn"),
      modalClose: byId("modalCloseBtn")
    };
  }

  bindDom() {
    const click = (element, handler) => {
      element.addEventListener("click", () => {
        this.callbacks.audioClick?.();
        handler();
      });
    };
    click(this.elements.quickMatch, () => this.startWithName("quick"));
    click(this.elements.createPrivate, () => this.startWithName("private"));
    click(this.elements.joinRoom, () => this.startWithName("join"));
    click(this.elements.practice, () => this.startWithName("practice"));
    click(this.elements.botLobby, () => this.startWithName("bot"));
    click(this.elements.sandbox, () => this.startWithName("sandbox"));
    click(this.elements.startMatch, () => this.callbacks.startMatch?.());
    click(this.elements.leaveRoom, () => this.callbacks.leaveRoom?.());
    click(this.elements.playAgain, () => this.callbacks.playAgain?.(this.room));
    click(this.elements.returnLobby, () => this.callbacks.leaveRoom?.());
    click(this.elements.settings, () => this.openSettings());
    click(this.elements.howToPlay, () => this.openHowToPlay());
    click(this.elements.modalClose, () => this.closeModal());
    click(this.elements.mapClose, () => this.closeMap());
    this.elements.roomCodeInput.addEventListener("input", () => {
      this.elements.roomCodeInput.value = this.elements.roomCodeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    });
  }

  on(callbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  startWithName(mode) {
    const name = this.elements.displayName.value.trim() || "Runner";
    this.callbacks.createProfile?.(name);
    if (mode === "quick") this.callbacks.quickMatch?.();
    if (mode === "private") this.callbacks.createPrivate?.();
    if (mode === "join") this.callbacks.joinRoom?.(this.elements.roomCodeInput.value);
    if (mode === "practice") this.callbacks.practice?.();
    if (mode === "bot") this.callbacks.botLobby?.();
    if (mode === "sandbox") this.callbacks.sandbox?.();
  }

  showLoaded() {
    this.elements.loading.classList.add("hidden");
    this.elements.menu.classList.remove("hidden");
  }

  setConnection(detail) {
    if (detail.connected) {
      this.elements.connectionStatus.textContent = "Connected to hosted game server.";
    } else if (detail.reconnecting) {
      this.elements.connectionStatus.textContent = "Reconnecting to game server...";
    } else {
      this.elements.connectionStatus.textContent = detail.reason || "Disconnected. Online multiplayer needs the game server.";
    }
  }

  setPing(ping) {
    this.lastPing = ping;
    this.updateNetworkStats();
  }

  setFps(fps) {
    this.lastFps = fps;
    this.elements.fpsCounter.textContent = `FPS ${Math.round(fps)}`;
    this.elements.fpsCounter.classList.toggle("hidden", !this.settings.values.showFps);
    this.updateNetworkStats();
  }

  updateNetworkStats() {
    this.elements.networkStats.classList.toggle("hidden", !this.settings.values.showPing);
    this.elements.networkStats.textContent = `Ping ${this.lastPing || "--"} ms`;
  }

  setRoomState(room) {
    this.room = room;
    if (!room) {
      this.showMenu();
      return;
    }
    if (room.status === "playing") {
      this.showGame();
      return;
    }
    if (room.status === "finished") {
      this.showResults(this.snapshot);
      return;
    }
    this.elements.menu.classList.add("hidden");
    this.elements.hud.classList.add("hidden");
    this.elements.results.classList.add("hidden");
    this.elements.room.classList.remove("hidden");
    this.elements.roomTypeLabel.textContent = `${labelRoomType(room.roomType)} Room`;
    this.elements.roomCodeLabel.textContent = room.roomCode;
    const status = room.status === "countdown"
      ? `Launch starts in ${room.countdownRemaining}s.`
      : "Waiting in lobby.";
    this.elements.roomStatusLabel.textContent = status;
    this.elements.playerList.innerHTML = room.players.map((player) => `
      <div class="player-row">
        <span>${escapeHtml(player.name)}</span>
        <strong>${player.id === room.hostId ? "Host" : "Ready"}</strong>
      </div>
    `).join("");
    const isHost = room.viewer && room.viewer.id === room.hostId;
    this.elements.startMatch.disabled = !isHost || room.status === "countdown";
    this.elements.startMatch.textContent = room.status === "countdown" ? "Starting" : "Start Match";
  }

  setSnapshot(snapshot) {
    this.snapshot = snapshot;
    this.self = snapshot && snapshot.self;
    if (!snapshot) return;
    if (snapshot.status === "playing") {
      this.showGame();
      this.updateHud(snapshot);
    }
    if (snapshot.status === "finished") {
      this.showResults(snapshot);
    }
  }

  showMenu() {
    this.elements.menu.classList.remove("hidden");
    this.elements.room.classList.add("hidden");
    this.elements.results.classList.add("hidden");
    this.elements.hud.classList.add("hidden");
  }

  showGame() {
    this.elements.menu.classList.add("hidden");
    this.elements.room.classList.add("hidden");
    this.elements.results.classList.add("hidden");
    this.elements.hud.classList.remove("hidden");
  }

  updateHud(snapshot) {
    const self = snapshot.self;
    if (!self) return;
    this.elements.healthText.textContent = Math.round(self.health);
    this.elements.shieldText.textContent = Math.round(self.shield);
    this.elements.healthBar.style.width = `${Math.max(0, self.health)}%`;
    this.elements.shieldBar.style.width = `${Math.max(0, self.shield)}%`;
    this.elements.weaponLabel.textContent = getWeaponLabel(self.inventory[self.selectedSlot]);
    this.elements.ammoLabel.textContent = getAmmoLabel(self);
    this.elements.materialsLabel.textContent = `Materials ${self.materials}`;
    this.elements.remainingLabel.textContent = `${snapshot.playersRemaining} left`;
    this.elements.matchChip.textContent = dropLabel(snapshot);
    this.elements.stormLabel.textContent = snapshot.storm
      ? `Storm ${snapshot.storm.mode} ${formatSeconds(snapshot.storm.secondsRemaining)}`
      : "Storm waiting";
    this.renderInventory(self);
    this.renderKillFeed(snapshot.killFeed || []);
    this.renderMiniMap(snapshot);
    if (this.mapOpen) this.renderFullMap(snapshot);
    if (!self.alive) {
      this.elements.interactionPrompt.textContent = snapshot.roomType === "practice" || snapshot.roomType === "sandbox"
        ? "Press the respawn button in results or return to lobby"
        : "Spectating";
      this.elements.interactionPrompt.classList.remove("hidden");
    }
  }

  renderInventory(self) {
    this.elements.inventory.innerHTML = self.inventory.map((item, index) => {
      const active = index === self.selectedSlot ? " active" : "";
      const label = getWeaponLabel(item);
      const detail = item && item.slotType === "weapon" && WEAPON_STATS[item.weaponId]
        ? `${item.ammoInMag}/${WEAPON_STATS[item.weaponId].magazineSize}`
        : item && item.slotType === "consumable" ? item.kind : "";
      return `<div class="slot${active}"><strong>${index + 1}</strong><br>${escapeHtml(label)}<br><span>${escapeHtml(detail)}</span></div>`;
    }).join("");
  }

  renderKillFeed(items) {
    this.elements.killFeed.innerHTML = items.slice(-5).reverse().map((item) => `<div>${escapeHtml(item.message)}</div>`).join("");
  }

  renderMiniMap(snapshot) {
    drawMap(this.elements.miniMap, snapshot, { compact: true });
  }

  renderFullMap(snapshot = this.snapshot) {
    if (!snapshot) return;
    drawMap(this.elements.fullMap, snapshot, { compact: false });
  }

  toggleMap(snapshot = this.snapshot) {
    this.mapOpen = !this.mapOpen;
    this.elements.mapOverlay.classList.toggle("hidden", !this.mapOpen);
    if (this.mapOpen) this.renderFullMap(snapshot);
    return this.mapOpen;
  }

  closeMap() {
    this.mapOpen = false;
    this.elements.mapOverlay.classList.add("hidden");
  }

  showBuildIndicator(enabled, piece) {
    this.elements.buildIndicator.classList.toggle("hidden", !enabled);
    this.elements.buildIndicator.textContent = `Build: ${pieceName(piece)}`;
  }

  showInteract(label) {
    this.elements.interactionPrompt.classList.toggle("hidden", !label);
    this.elements.interactionPrompt.textContent = label || "";
  }

  showHitMarker() {
    this.elements.hitMarker.classList.remove("hidden");
    clearTimeout(this.hitTimeout);
    this.hitTimeout = setTimeout(() => this.elements.hitMarker.classList.add("hidden"), 120);
  }

  showResults(snapshot) {
    this.elements.menu.classList.add("hidden");
    this.elements.room.classList.add("hidden");
    this.elements.hud.classList.add("hidden");
    this.elements.results.classList.remove("hidden");
    const self = snapshot && snapshot.self;
    const winnerName = snapshot ? snapshot.winnerName : "";
    this.elements.resultTitle.textContent = winnerName ? `${winnerName} wins` : "Results";
    const accuracy = self && self.shotsFired ? `${Math.round((self.shotsHit / self.shotsFired) * 100)}%` : "--";
    this.elements.resultStats.innerHTML = [
      ["Placement", self && self.placement ? `#${self.placement}` : "--"],
      ["Eliminations", self ? self.eliminations : 0],
      ["Damage dealt", self ? self.damageDealt : 0],
      ["Damage taken", self ? self.damageTaken : 0],
      ["Builds placed", self ? self.buildsPlaced : 0],
      ["Accuracy", accuracy]
    ].map(([label, value]) => `<div class="stat"><span>${label}</span><strong>${value}</strong></div>`).join("");
  }

  toast(message) {
    const div = document.createElement("div");
    div.className = "toast";
    div.textContent = message;
    this.elements.toastLayer.appendChild(div);
    setTimeout(() => div.remove(), 3200);
  }

  openSettings() {
    const s = this.settings.values;
    this.elements.modalContent.innerHTML = `
      <h2>Settings</h2>
      ${slider("masterVolume", "Master Volume", s.masterVolume, 0, 1, 0.01)}
      ${slider("musicVolume", "Music Volume", s.musicVolume, 0, 1, 0.01)}
      ${slider("sfxVolume", "SFX Volume", s.sfxVolume, 0, 1, 0.01)}
      ${slider("mouseSensitivity", "Mouse Sensitivity", s.mouseSensitivity, 0.001, 0.008, 0.0001)}
      ${checkbox("invertY", "Invert Mouse Y", s.invertY)}
      ${checkbox("showFps", "Show FPS", s.showFps)}
      ${checkbox("showPing", "Show Ping", s.showPing)}
      ${checkbox("reducedMotion", "Reduced Motion", s.reducedMotion)}
      <label class="field-label">Graphics Quality</label>
      <select id="setting-graphicsQuality">
        ${["Low", "Medium", "High"].map((q) => `<option ${q === s.graphicsQuality ? "selected" : ""}>${q}</option>`).join("")}
      </select>
      <div class="thin-row" style="margin-top:12px">
        <button id="fullscreenBtn">Fullscreen</button>
        <button id="resetSettingsBtn">Reset Keybinds</button>
      </div>
    `;
    this.elements.modal.classList.remove("hidden");
    for (const key of ["masterVolume", "musicVolume", "sfxVolume", "mouseSensitivity"]) {
      document.getElementById(`setting-${key}`).addEventListener("input", (event) => {
        this.settings.set(key, Number(event.target.value));
      });
    }
    for (const key of ["invertY", "showFps", "showPing", "reducedMotion"]) {
      document.getElementById(`setting-${key}`).addEventListener("change", (event) => {
        this.settings.set(key, event.target.checked);
      });
    }
    document.getElementById("setting-graphicsQuality").addEventListener("change", (event) => {
      this.settings.set("graphicsQuality", event.target.value);
    });
    document.getElementById("fullscreenBtn").addEventListener("click", () => document.documentElement.requestFullscreen?.());
    document.getElementById("resetSettingsBtn").addEventListener("click", () => {
      this.settings.reset();
      this.openSettings();
    });
  }

  renderSettingsModal() {
    this.openSettings();
  }

  openHowToPlay() {
    this.elements.modalContent.innerHTML = `
      <h2>How to Play</h2>
      <ul>
        <li>Move with WASD, sprint with Shift, jump with Space, and look with the mouse.</li>
        <li>Left click shoots. Press R to reload and 1-5 to switch inventory slots.</li>
        <li>Press E near glowing loot to pick it up. Press G to use a selected healing or shield item.</li>
        <li>Press M to open the island map and check storm, players, floor loot, chests, and ammo boxes.</li>
        <li>Press Q for build mode. Z, X, C, and V choose wall, ramp, floor, and roof. Left click places the preview.</li>
        <li>The match opens on Spawn Island, then the battle bus carries players across the main island before the drop.</li>
        <li>Stay inside the storm circle. The last surviving player wins.</li>
        <li>Online multiplayer uses the hosted Node server. Local tabs are only a development test method.</li>
      </ul>
    `;
    this.elements.modal.classList.remove("hidden");
  }

  closeModal() {
    this.elements.modal.classList.add("hidden");
  }
}

function drawMap(canvas, snapshot, options = {}) {
  const compact = Boolean(options.compact);
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  const pad = compact ? 6 : 28;
  const usable = Math.min(w, h) - pad * 2;
  const scale = usable / MAP_SIZE;
  const centerX = w / 2;
  const centerY = h / 2;
  const toMap = (point) => ({
    x: centerX + point.x * scale,
    y: centerY + point.z * scale
  });

  ctx.clearRect(0, 0, w, h);
  const gradient = ctx.createLinearGradient(0, 0, w, h);
  gradient.addColorStop(0, "#123c2e");
  gradient.addColorStop(0.48, "#1d5a3a");
  gradient.addColorStop(1, "#0e7490");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.fillStyle = "rgba(15, 23, 42, 0.2)";
  for (let i = -140; i <= 140; i += 28) {
    ctx.fillRect(i * scale - 1, -usable / 2, 2, usable);
    ctx.fillRect(-usable / 2, i * scale - 1, usable, 2);
  }
  ctx.restore();

  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = compact ? 1 : 2;
  ctx.strokeRect(centerX - usable / 2, centerY - usable / 2, usable, usable);

  drawMapRoad(ctx, toMap({ x: 0, z: -120 }), toMap({ x: 0, z: 120 }), compact);
  drawMapRoad(ctx, toMap({ x: -120, z: 0 }), toMap({ x: 120, z: 0 }), compact);
  drawMapRoad(ctx, toMap({ x: -90, z: -80 }), toMap({ x: 90, z: 70 }), compact);

  if (!compact) {
    for (const poi of MAP_POIS) {
      const p = toMap(poi);
      ctx.fillStyle = "rgba(250, 204, 21, 0.9)";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#f8fafc";
      ctx.font = "800 14px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(poi.name, p.x, p.y - 10);
    }
  }

  const loot = snapshot.loot || [];
  for (const item of loot) {
    const p = toMap(item);
    const isChest = item.type === "chest";
    const isAmmoBox = item.type === "ammoBox";
    ctx.fillStyle = isChest ? "#f59e0b" : isAmmoBox ? "#22c55e" : "#f8fafc";
    if (isChest) {
      ctx.fillRect(p.x - (compact ? 2 : 4), p.y - (compact ? 2 : 4), compact ? 4 : 8, compact ? 4 : 8);
    } else if (isAmmoBox) {
      ctx.fillRect(p.x - (compact ? 2 : 4), p.y - (compact ? 1 : 3), compact ? 4 : 8, compact ? 2 : 6);
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, compact ? 0.9 : 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (snapshot.storm && snapshot.storm.current) {
    const zone = snapshot.storm.current;
    const p = toMap(zone);
    ctx.strokeStyle = "#a78bfa";
    ctx.lineWidth = compact ? 2 : 4;
    ctx.beginPath();
    ctx.arc(p.x, p.y, zone.radius * scale, 0, Math.PI * 2);
    ctx.stroke();
    if (!compact && snapshot.storm.target) {
      const target = toMap(snapshot.storm.target);
      ctx.strokeStyle = "rgba(167,139,250,0.45)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(target.x, target.y, snapshot.storm.target.radius * scale, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  const selfId = snapshot.self && snapshot.self.id;
  for (const player of snapshot.players || []) {
    if (!player.alive) continue;
    const p = toMap(player);
    ctx.fillStyle = player.id === selfId ? "#facc15" : player.isBot ? "#fb7185" : "#2dd4bf";
    ctx.beginPath();
    ctx.arc(p.x, p.y, player.id === selfId ? (compact ? 4 : 8) : (compact ? 2.5 : 5), 0, Math.PI * 2);
    ctx.fill();
    if (!compact && player.id === selfId) {
      ctx.strokeStyle = "#020617";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  if (!compact) {
    ctx.fillStyle = "rgba(2, 6, 23, 0.68)";
    ctx.fillRect(24, h - 56, w - 48, 32);
    ctx.fillStyle = "#cbd5e1";
    ctx.font = "800 15px Inter, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`Storm: ${snapshot.storm ? `${snapshot.storm.mode} ${formatSeconds(snapshot.storm.secondsRemaining)}` : "waiting"} | Loot: ${loot.length} | Players: ${snapshot.playersRemaining}`, 38, h - 35);
  }
}

function drawMapRoad(ctx, from, to, compact) {
  ctx.strokeStyle = "rgba(226, 232, 240, 0.28)";
  ctx.lineWidth = compact ? 3 : 8;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
}

function labelRoomType(type) {
  if (type === "quick") return "Quick Match";
  if (type === "practice") return "Practice";
  if (type === "bot") return "Bot Lobby";
  if (type === "sandbox") return "Sandbox";
  return "Private";
}

function pieceName(piece) {
  return ({ wall: "Wall", ramp: "Ramp", floor: "Floor", roof: "Roof" })[piece] || "Wall";
}

function dropLabel(snapshot) {
  if (snapshot.dropState && snapshot.dropState.phase === "spawnIsland") return "Spawn Island";
  if (snapshot.dropState && snapshot.dropState.phase === "bus") return "Battle Bus";
  if (!snapshot.self || snapshot.self.alive) return snapshot.status;
  return "Spectating";
}

function slider(key, label, value, min, max, step) {
  return `
    <label class="field-label" for="setting-${key}">${label}</label>
    <input id="setting-${key}" type="range" value="${value}" min="${min}" max="${max}" step="${step}">
  `;
}

function checkbox(key, label, value) {
  return `
    <label class="player-row" for="setting-${key}">
      <span>${label}</span>
      <input id="setting-${key}" type="checkbox" ${value ? "checked" : ""}>
    </label>
  `;
}
