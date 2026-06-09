export const RARITIES = ["Common", "Uncommon", "Rare", "Epic", "Legendary"];

export const RARITY_COLORS = {
  Common: "#dbeafe",
  Uncommon: "#86efac",
  Rare: "#60a5fa",
  Epic: "#c084fc",
  Legendary: "#f59e0b"
};

export const WEAPON_STATS = {};

function rarityKey(rarity) {
  return String(rarity).toLowerCase();
}

function addWeapon(id, config) {
  WEAPON_STATS[id] = {
    id,
    color: RARITY_COLORS[config.rarity] || "#dbeafe",
    pellets: 1,
    magazineSize: 1,
    ammoType: "light",
    model: "rifle",
    ...config
  };
}

function addRaritySeries(baseId, damages, config) {
  RARITIES.forEach((rarity, index) => {
    if (damages[index] === null || damages[index] === undefined) return;
    const id = baseId + "_" + rarityKey(rarity);
    const displayName = typeof config.name === "function" ? config.name(rarity, index) : config.name;
    const pellets = config.pellets || 1;
    const bodyDamage = damages[index];
    addWeapon(id, {
      ...config,
      id,
      name: displayName,
      rarity,
      bodyDamage,
      damage: config.damagePerPellet ? Math.max(1, bodyDamage / pellets) : bodyDamage,
      pellets
    });
  });
}

addRaritySeries("assault_rifle", [30, 31, 33, 35, 36], {
  name: (rarity) => rarity === "Epic" || rarity === "Legendary" ? "SCAR Assault Rifle" : "Assault Rifle",
  ammoType: "medium",
  fireRate: 5.5,
  magazineSize: 30,
  headshotMultiplier: 1.5,
  model: "assault"
});

addRaritySeries("burst_assault", [27, 28, 29, 32, 33], {
  name: (rarity) => rarity === "Epic" || rarity === "Legendary" ? "AUG Burst Rifle" : "Burst Assault Rifle",
  ammoType: "medium",
  fireRate: 1.75,
  magazineSize: 30,
  roundsPerShot: 3,
  burstCount: 3,
  headshotMultiplier: 1.5,
  model: "burst"
});

addRaritySeries("pump_shotgun", [70, 80, 90, 100, 110], {
  name: "Pump Shotgun",
  ammoType: "shells",
  fireRate: 0.72,
  magazineSize: 5,
  pellets: 10,
  damagePerPellet: true,
  headshotMultiplier: 2,
  model: "pump"
});

addRaritySeries("tactical_shotgun", [71, 75, 79, 83, 87], {
  name: "Tactical Shotgun",
  ammoType: "shells",
  fireRate: 1.5,
  magazineSize: 8,
  pellets: 10,
  damagePerPellet: true,
  headshotMultiplier: 2,
  model: "tactical"
});

addRaritySeries("smg", [17, 18, 19, 20, 21], {
  name: "Submachine Gun",
  ammoType: "light",
  fireRate: 12,
  magazineSize: 30,
  headshotMultiplier: 1.5,
  model: "smg"
});

addRaritySeries("pistol", [24, 25, 26, 27, 28], {
  name: "Pistol",
  ammoType: "light",
  fireRate: 6.75,
  magazineSize: 16,
  headshotMultiplier: 2,
  model: "pistol"
});

addRaritySeries("bolt_sniper", [95, 100, 105, 110, 116], {
  name: "Bolt-Action Sniper Rifle",
  ammoType: "heavy",
  fireRate: 0.33,
  magazineSize: 1,
  headshotMultiplier: 2.5,
  model: "sniper"
});

["Rare", "Epic", "Legendary"].forEach((rarity, index) => {
  const damages = [110, 116, 121];
  const key = rarityKey(rarity);
  addWeapon("rocket_launcher_" + key, {
    name: "Rocket Launcher",
    rarity,
    bodyDamage: damages[index],
    damage: damages[index],
    ammoType: "rockets",
    fireRate: 0.32,
    magazineSize: 1,
    headshotMultiplier: 1,
    model: "rocket",
    explosionRadius: 8.5
  });
});

addWeapon("bandage_launcher_rare", {
  name: "Bandage Launcher",
  rarity: "Rare",
  bodyDamage: 0,
  damage: 0,
  healAmount: 15,
  maxHealth: 105,
  ammoType: "charges",
  fireRate: 1.25,
  magazineSize: 5,
  rechargeTime: 8,
  model: "medLauncher",
  slotSize: 2
});

WEAPON_STATS.pistol = WEAPON_STATS.pistol_common;
WEAPON_STATS.assault = WEAPON_STATS.assault_rifle_uncommon;
WEAPON_STATS.shotgun = WEAPON_STATS.pump_shotgun_rare;
WEAPON_STATS.sniper = WEAPON_STATS.bolt_sniper_epic;
WEAPON_STATS.rocket = WEAPON_STATS.rocket_launcher_rare;
WEAPON_STATS.bandageLauncher = WEAPON_STATS.bandage_launcher_rare;

export const CONSUMABLE_STATS = {
  smallShield: { itemId: "smallShield", name: "Small Shield", kind: "shield", amount: 25, maxShield: 50, maxStack: 6, rarity: "Uncommon", color: "#38bdf8" },
  shieldPotion: { itemId: "shieldPotion", name: "Shield Potion", kind: "shield", amount: 50, maxShield: 100, maxStack: 3, rarity: "Rare", color: "#2563eb" },
  bandage: { itemId: "bandage", name: "Bandages", kind: "heal", amount: 15, maxHealth: 75, maxStack: 15, rarity: "Common", color: "#f8fafc" },
  medkit: { itemId: "medkit", name: "Medkit", kind: "heal", amount: 100, maxHealth: 100, maxStack: 3, rarity: "Uncommon", color: "#ef4444" },
  grenade: { itemId: "grenade", name: "Grenade", kind: "explosive", damage: 100, radius: 7.5, maxStack: 6, rarity: "Common", color: "#4ade80" },
  fishingRod: { itemId: "fishingRod", name: "Fishing Rod", kind: "utility", maxStack: 1, rarity: "Common", color: "#a16207" }
};

export function getWeaponLabel(item) {
  if (!item) return "Empty";
  if (item.slotType === "reserved") return "Linked Slot";
  if (item.slotType === "consumable") {
    const base = item.name || (CONSUMABLE_STATS[item.itemId] && CONSUMABLE_STATS[item.itemId].name) || item.itemId || "Item";
    return (item.count || 1) > 1 ? base + " x" + item.count : base;
  }
  const stats = WEAPON_STATS[item.weaponId];
  return stats ? stats.name : "Weapon";
}

export function getAmmoLabel(self) {
  const item = self && self.inventory ? self.inventory[self.selectedSlot] : null;
  if (!item || item.slotType !== "weapon") return "--";
  const stats = WEAPON_STATS[item.weaponId];
  if (!stats) return "--";
  if (stats.ammoType === "charges") return item.ammoInMag + " charges";
  return item.ammoInMag + " / " + (self.ammo[stats.ammoType] || 0);
}

export function getItemColor(item) {
  if (!item) return "#f8fafc";
  if (item.type === "weapon" && WEAPON_STATS[item.weaponId]) return WEAPON_STATS[item.weaponId].color;
  if (item.slotType === "weapon" && WEAPON_STATS[item.weaponId]) return WEAPON_STATS[item.weaponId].color;
  if (item.itemId && CONSUMABLE_STATS[item.itemId]) return CONSUMABLE_STATS[item.itemId].color;
  if (item.color) return item.color;
  return "#f8fafc";
}
