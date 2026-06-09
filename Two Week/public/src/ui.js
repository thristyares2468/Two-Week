import { escapeHtml, formatSeconds } from "./utils.js";
import { CONSUMABLE_STATS, getAmmoLabel, getItemColor, getWeaponLabel, WEAPON_STATS } from "./weapons.js";
import { DEFAULT_KEYBINDS } from "./settings.js";

const MAP_SIZE = 320;
const MAP_POIS = [
  { name: "Craggy Cliffs", x: 8, z: -122 },
  { name: "Pleasant Park", x: -52, z: -84 },
  { name: "Steamy Stacks", x: 82, z: -88 },
  { name: "Sweaty Sands", x: -104, z: -52 },
  { name: "Frenzy Farm", x: 18, z: -42 },
  { name: "Dirty Docks", x: 106, z: -20 },
  { name: "Salty Springs", x: -34, z: -12 },
  { name: "Holly Hedges", x: -88, z: 18 },
  { name: "Weeping Woods", x: -42, z: 38 },
  { name: "Retail Row", x: 86, z: 38 },
  { name: "Lazy Lake", x: 48, z: 54 },
  { name: "Slurpy Swamp", x: -66, z: 88 },
  { name: "Misty Meadows", x: 28, z: 110 }
];

const KEYBIND_GROUPS = [
  {
    title: "Movement",
    items: [
      ["moveForward", "Move Forward"],
      ["moveBackward", "Move Back"],
      ["moveLeft", "Move Left"],
      ["moveRight", "Move Right"],
      ["jump", "Jump"],
      ["sprint", "Sprint"],
      ["crouch", "Crouch"]
    ]
  },
  {
    title: "Combat And Loot",
    items: [
      ["interact", "Interact / Pick Up"],
      ["reloadRotate", "Reload / Rotate Build"],
      ["useItem", "Use Item"],
      ["toggleMap", "Open Map"],
      ["slot1", "Slot 1"],
      ["slot2", "Slot 2"],
      ["slot3", "Slot 3"],
      ["slot4", "Slot 4"],
      ["slot5", "Slot 5"]
    ]
  },
  {
    title: "Building",
    items: [
      ["buildMode", "Toggle Build Mode"],
      ["buildWall", "Wall"],
      ["buildRamp", "Ramp"],
      ["buildFloor", "Floor"],
      ["buildRoof", "Roof"]
    ]
  }
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
      lobbyLayout: document.querySelector(".lobby-layout"),
      lobbyTabPanel: byId("lobbyTabPanel"),
      navTabs: Array.from(document.querySelectorAll("[data-lobby-tab]")),
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
    for (const tab of this.elements.navTabs) {
      click(tab, () => this.openLobbyTab(tab.dataset.lobbyTab));
    }
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

  openLobbyTab(tab) {
    if (!tab) return;
    for (const button of this.elements.navTabs) {
      const active = button.dataset.lobbyTab === tab;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
    }
    if (tab === "settings") {
      this.elements.lobbyLayout.classList.remove("hidden");
      this.elements.lobbyTabPanel.classList.add("hidden");
      this.openSettings();
      return;
    }
    if (tab === "lobby") {
      this.elements.lobbyLayout.classList.remove("hidden");
      this.elements.lobbyTabPanel.classList.add("hidden");
      return;
    }
    this.elements.lobbyLayout.classList.add("hidden");
    this.elements.lobbyTabPanel.classList.remove("hidden");
    if (tab === "locker") this.renderLockerTab();
    if (tab === "map") this.renderLobbyMapTab();
    if (tab === "stats") this.renderStatsTab();
  }

  renderLockerTab() {
    this.elements.lobbyTabPanel.innerHTML = '<div class="tab-shell locker-tab"><div><div class="brand-kicker">Locker</div><h2>Runner Loadout</h2><p>Choose a clean original runner style before jumping into the island.</p></div><div class="locker-preview"><div class="locker-figure" aria-hidden="true"><span></span><b></b></div><div class="locker-swatches"><button style="--swatch:#2dd4bf" aria-label="Teal runner"></button><button style="--swatch:#facc15" aria-label="Yellow runner"></button><button style="--swatch:#fb7185" aria-label="Rose runner"></button><button style="--swatch:#60a5fa" aria-label="Blue runner"></button></div></div></div>';
  }

  renderLobbyMapTab() {
    this.elements.lobbyTabPanel.innerHTML = '<div class="tab-shell map-tab-shell"><div class="map-tab-copy"><div class="brand-kicker">Island Map</div><h2>Drop Planner</h2><p>Named areas, loot sources, and storm rings appear here before and during matches.</p></div><div class="lobby-map-card"><canvas id="lobbyMapCanvas" width="900" height="900"></canvas><div class="map-legend"><span><b class="legend-player"></b> You</span><span><b class="legend-enemy"></b> Players</span><span><b class="legend-loot"></b> Floor loot</span><span><b class="legend-chest"></b> Chests</span><span><b class="legend-ammo"></b> Ammo boxes</span><span><b class="legend-storm"></b> Safe zone</span></div></div></div>';
    const canvas = document.getElementById("lobbyMapCanvas");
    drawMap(canvas, this.snapshot || makeLobbyMapSnapshot(), { compact: false, showLabels: true });
  }

  renderStatsTab() {
    const self = this.snapshot && this.snapshot.self;
    const stats = [
      ["Eliminations", self ? self.eliminations : 0],
      ["Damage Dealt", self ? self.damageDealt : 0],
      ["Damage Taken", self ? self.damageTaken : 0],
      ["Builds Placed", self ? self.buildsPlaced : 0],
      ["Accuracy", self && self.shotsFired ? String(Math.round((self.shotsHit / self.shotsFired) * 100)) + "%" : "--"],
      ["Current Room", this.room ? this.room.roomCode : "None"]
    ];
    this.elements.lobbyTabPanel.innerHTML = '<div class="tab-shell stats-tab"><div><div class="brand-kicker">Stats</div><h2>Match Snapshot</h2><p>Live stats update once you enter a match.</p></div><div class="result-stats">' + stats.map(([label, value]) => '<div class="stat"><span>' + escapeHtml(label) + '</span><strong>' + escapeHtml(String(value)) + '</strong></div>').join("") + '</div></div>';
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
      const color = getItemColor(item);
      let detail = "";
      if (item && item.slotType === "weapon" && WEAPON_STATS[item.weaponId]) {
        const stats = WEAPON_STATS[item.weaponId];
        detail = stats.ammoType === "charges" ? item.ammoInMag + " charges" : item.ammoInMag + "/" + stats.magazineSize;
      } else if (item && item.slotType === "consumable") {
        const stats = CONSUMABLE_STATS[item.itemId] || item;
        if (stats.kind === "shield") detail = "+" + (stats.amount || item.amount || 0) + " shield";
        else if (stats.kind === "heal") detail = "+" + (stats.amount || item.amount || 0) + " HP";
        else if (stats.kind === "explosive") detail = (stats.damage || item.damage || 0) + " dmg";
        else detail = stats.kind || item.kind || "utility";
      } else if (item && item.slotType === "reserved") {
        detail = "two-slot item";
      }
      return '<div class="slot' + active + '" style="--slot-color: ' + escapeHtml(color) + '"><strong>' + (index + 1) + '</strong><br>' + escapeHtml(label) + '<br><span>' + escapeHtml(detail) + '</span></div>';
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
    drawMap(this.elements.fullMap, snapshot, { compact: false, showLabels: true });
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
      <h3>Keybinds</h3>
      <p class="settings-note">Click a bind, then press a new key. If that key is already used, the two binds swap.</p>
      <div class="keybind-panel">
        ${renderKeybindGroups(s.keybinds || DEFAULT_KEYBINDS)}
      </div>
      <div class="thin-row" style="margin-top:12px">
        <button id="fullscreenBtn">Fullscreen</button>
        <button id="resetKeybindsBtn">Reset Binds</button>
      </div>
      <div class="thin-row" style="margin-top:8px">
        <button id="resetSettingsBtn">Reset All Settings</button>
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
    for (const button of this.elements.modalContent.querySelectorAll("[data-bind-action]")) {
      button.addEventListener("click", () => this.captureKeybind(button.dataset.bindAction, button));
    }
    document.getElementById("fullscreenBtn").addEventListener("click", () => document.documentElement.requestFullscreen?.());
    document.getElementById("resetKeybindsBtn").addEventListener("click", () => {
      this.settings.resetKeybinds();
      this.openSettings();
    });
    document.getElementById("resetSettingsBtn").addEventListener("click", () => {
      this.settings.reset();
      this.openSettings();
    });
  }

  renderSettingsModal() {
    this.openSettings();
  }

  captureKeybind(action, button) {
    if (!DEFAULT_KEYBINDS[action]) return;
    const previousText = button.textContent;
    button.textContent = "Press a key";
    button.classList.add("listening");
    const onKeyDown = (event) => {
      event.preventDefault();
      event.stopPropagation();
      button.classList.remove("listening");
      if (event.code === "Escape") {
        button.textContent = previousText;
        return;
      }
      if (!isBindableCode(event.code)) {
        button.textContent = previousText;
        this.toast("That key cannot be used as a bind.");
        return;
      }
      this.settings.setKeybind(action, event.code);
      this.openSettings();
    };
    window.addEventListener("keydown", onKeyDown, { capture: true, once: true });
  }

  openHowToPlay() {
    this.elements.modalContent.innerHTML = `
      <h2>How to Play</h2>
      <ul>
        <li>Move with WASD, sprint with Shift, jump with Space, and look with the mouse. Keyboard binds can be changed in Settings.</li>
        <li>Left click shoots. Press R to reload and 1-5 to switch inventory slots by default.</li>
        <li>Press E near glowing loot to pick it up. Press G to use a selected healing or shield item by default.</li>
        <li>Press M to open the island map and check storm, players, floor loot, chests, and ammo boxes by default.</li>
        <li>Press Q for build mode. Z, X, C, and V choose wall, ramp, floor, and roof by default. Left click places the preview.</li>
        <li>The match opens on Spawn Island, then the battle bus carries players across the main island. Press Space during the bus phase to drop early.</li>
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
  drawIslandBase(ctx, w, h, centerX, centerY, usable, compact);

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

  if (!compact || options.showLabels) {
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

function drawIslandBase(ctx, w, h, centerX, centerY, usable, compact) {
  const water = ctx.createLinearGradient(0, 0, w, h);
  water.addColorStop(0, "#0ea5c7");
  water.addColorStop(0.55, "#087d9c");
  water.addColorStop(1, "#064e70");
  ctx.fillStyle = water;
  ctx.fillRect(0, 0, w, h);

  const points = [[-0.06, -0.49], [0.15, -0.46], [0.32, -0.37], [0.47, -0.18], [0.43, 0.08], [0.36, 0.27], [0.16, 0.47], [-0.05, 0.45], [-0.25, 0.37], [-0.43, 0.18], [-0.48, -0.05], [-0.38, -0.27], [-0.22, -0.42]];
  ctx.save();
  ctx.beginPath();
  points.forEach(([x, y], index) => {
    const px = centerX + x * usable;
    const py = centerY + y * usable;
    if (index === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.closePath();
  ctx.fillStyle = "#2f9a4f";
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = compact ? 8 : 22;
  ctx.fill();
  ctx.clip();

  const land = ctx.createRadialGradient(centerX, centerY, usable * 0.05, centerX, centerY, usable * 0.56);
  land.addColorStop(0, "#9fcf50");
  land.addColorStop(0.36, "#5fb64d");
  land.addColorStop(0.72, "#2f8f55");
  land.addColorStop(1, "#216f50");
  ctx.fillStyle = land;
  ctx.fillRect(centerX - usable / 2, centerY - usable / 2, usable, usable);

  ctx.strokeStyle = "rgba(99, 179, 237, 0.8)";
  ctx.lineWidth = compact ? 2 : 6;
  ctx.beginPath();
  ctx.moveTo(centerX - usable * 0.24, centerY - usable * 0.38);
  ctx.bezierCurveTo(centerX - usable * 0.04, centerY - usable * 0.18, centerX - usable * 0.18, centerY + usable * 0.08, centerX + usable * 0.1, centerY + usable * 0.28);
  ctx.bezierCurveTo(centerX + usable * 0.2, centerY + usable * 0.34, centerX + usable * 0.1, centerY + usable * 0.42, centerX + usable * 0.02, centerY + usable * 0.48);
  ctx.stroke();

  ctx.fillStyle = "rgba(232, 240, 255, 0.9)";
  ctx.beginPath();
  ctx.ellipse(centerX + usable * 0.26, centerY + usable * 0.33, usable * 0.08, usable * 0.055, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function makeLobbyMapSnapshot() {
  return {
    loot: [],
    players: [],
    playersRemaining: 0,
    self: null,
    storm: {
      mode: "waiting",
      secondsRemaining: 0,
      current: { x: 0, z: 0, radius: 128 },
      target: { x: 16, z: -12, radius: 82 }
    }
  };
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

function renderKeybindGroups(keybinds) {
  return KEYBIND_GROUPS.map((group) => `
    <section class="keybind-group">
      <h4>${group.title}</h4>
      ${group.items.map(([action, label]) => `
        <div class="keybind-row">
          <span>${label}</span>
          <button type="button" class="keybind-button" data-bind-action="${action}">${keyLabel(keybinds[action] || DEFAULT_KEYBINDS[action])}</button>
        </div>
      `).join("")}
    </section>
  `).join("");
}

function isBindableCode(code) {
  if (!code) return false;
  if (["Escape", "MetaLeft", "MetaRight", "AltLeft", "AltRight"].includes(code)) return false;
  return /^(Key|Digit|Numpad|Arrow|Shift|Control|Space|Tab|Backquote|Minus|Equal|Bracket|Backslash|Semicolon|Quote|Comma|Period|Slash)/.test(code);
}

function keyLabel(code) {
  const labels = {
    Space: "Space",
    ShiftLeft: "Left Shift",
    ShiftRight: "Right Shift",
    ControlLeft: "Left Ctrl",
    ControlRight: "Right Ctrl",
    Tab: "Tab",
    Backquote: "`",
    Minus: "-",
    Equal: "=",
    BracketLeft: "[",
    BracketRight: "]",
    Backslash: "\\",
    Semicolon: ";",
    Quote: "'",
    Comma: ",",
    Period: ".",
    Slash: "/",
    ArrowUp: "Up",
    ArrowDown: "Down",
    ArrowLeft: "Left",
    ArrowRight: "Right"
  };
  if (labels[code]) return labels[code];
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Numpad")) return `Numpad ${code.slice(6)}`;
  return code || "Unbound";
}
