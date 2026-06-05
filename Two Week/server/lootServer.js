const {
  WEAPON_STATS,
  createWeaponInstance,
  distance2D,
  makeId,
  randomFloat,
  randomPointInCircle
} = require("./utils");
const { addInventoryItem } = require("./playerState");

const LOOT_TABLE = [
  { type: "weapon", weaponId: "assault", weight: 15 },
  { type: "weapon", weaponId: "shotgun", weight: 12 },
  { type: "weapon", weaponId: "sniper", weight: 7 },
  { type: "ammo", ammoType: "light", amount: 24, weight: 14 },
  { type: "ammo", ammoType: "medium", amount: 30, weight: 14 },
  { type: "ammo", ammoType: "shells", amount: 8, weight: 10 },
  { type: "ammo", ammoType: "heavy", amount: 5, weight: 8 },
  { type: "materials", amount: 35, weight: 14 },
  { type: "shield", amount: 25, itemId: "smallShield", weight: 8 },
  { type: "heal", amount: 35, itemId: "bandage", weight: 8 },
  { type: "heal", amount: 70, itemId: "medkit", weight: 4 }
];

const NAMED_LOOT_POINTS = [
  { name: "Rusty Depot", x: -54, z: -42, chest: 3, ammoBoxes: 3 },
  { name: "Neon Farm", x: 52, z: -54, chest: 3, ammoBoxes: 4 },
  { name: "Signal Hill", x: -82, z: 50, chest: 2, ammoBoxes: 2 },
  { name: "Broken Bridge", x: 74, z: 38, chest: 2, ammoBoxes: 3 },
  { name: "Solar Yard", x: 8, z: -84, chest: 3, ammoBoxes: 3 },
  { name: "Old Radio Town", x: -8, z: 10, chest: 5, ammoBoxes: 5 },
  { name: "Quarry Camp", x: 90, z: -12, chest: 3, ammoBoxes: 4 },
  { name: "Stormwatch Tower", x: -22, z: 82, chest: 2, ammoBoxes: 2 },
  { name: "Timber Flats", x: 44, z: 78, chest: 2, ammoBoxes: 3 },
  { name: "Blue Barns", x: -92, z: -10, chest: 3, ammoBoxes: 4 }
];

const FIELD_CONTAINER_POINTS = [
  { x: -118, z: -76, type: "chest" },
  { x: -118, z: 74, type: "ammoBox" },
  { x: 118, z: -72, type: "ammoBox" },
  { x: 114, z: 78, type: "chest" },
  { x: -36, z: -118, type: "chest" },
  { x: 40, z: 118, type: "ammoBox" },
  { x: 0, z: 52, type: "chest" },
  { x: 64, z: -4, type: "ammoBox" }
];

function weightedLoot() {
  const total = LOOT_TABLE.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;
  for (const item of LOOT_TABLE) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }
  return LOOT_TABLE[0];
}

function createLootItem(template, position, source = "ground") {
  const item = {
    id: makeId("loot"),
    type: template.type,
    x: Number(position.x.toFixed(2)),
    y: 0.4,
    z: Number(position.z.toFixed(2)),
    source,
    createdAt: Date.now()
  };
  if (template.type === "chest" || template.type === "ammoBox") {
    item.name = template.type === "chest" ? "Chest" : "Ammo Box";
    item.container = true;
    item.y = template.type === "chest" ? 0.8 : 0.55;
  }
  if (template.type === "weapon") {
    item.weaponId = template.weaponId;
    item.name = WEAPON_STATS[template.weaponId].name;
    item.rarity = WEAPON_STATS[template.weaponId].rarity;
  }
  if (template.type === "ammo") {
    item.ammoType = template.ammoType;
    item.amount = template.amount;
    item.name = `${template.ammoType} ammo`;
  }
  if (template.type === "materials") {
    item.amount = template.amount;
    item.name = "Materials";
  }
  if (template.type === "shield" || template.type === "heal") {
    item.amount = template.amount;
    item.itemId = template.itemId;
    item.name = template.itemId === "medkit" ? "Medkit" : template.itemId === "bandage" ? "Bandage" : "Small Shield";
  }
  return item;
}

function spawnLoot(room) {
  room.loot.clear();
  for (const point of NAMED_LOOT_POINTS) {
    const count = room.roomType === "sandbox" ? 2 : 5;
    for (let i = 0; i < count; i += 1) {
      const pos = {
        x: point.x + randomFloat(-14, 14),
        z: point.z + randomFloat(-14, 14)
      };
      const item = createLootItem(weightedLoot(), pos, point.name);
      room.loot.set(item.id, item);
    }
    const containerScale = room.roomType === "sandbox" ? 0.5 : 1;
    for (let i = 0; i < Math.ceil(point.chest * containerScale); i += 1) {
      const pos = {
        x: point.x + randomFloat(-18, 18),
        z: point.z + randomFloat(-18, 18)
      };
      const item = createLootItem({ type: "chest" }, pos, point.name);
      room.loot.set(item.id, item);
    }
    for (let i = 0; i < Math.ceil(point.ammoBoxes * containerScale); i += 1) {
      const pos = {
        x: point.x + randomFloat(-20, 20),
        z: point.z + randomFloat(-20, 20)
      };
      const item = createLootItem({ type: "ammoBox" }, pos, point.name);
      room.loot.set(item.id, item);
    }
  }
  for (let i = 0; i < 34; i += 1) {
    const pos = randomPointInCircle(108);
    const item = createLootItem(weightedLoot(), pos, "field");
    room.loot.set(item.id, item);
  }
  for (const point of FIELD_CONTAINER_POINTS) {
    const item = createLootItem({ type: point.type }, point, "field");
    room.loot.set(item.id, item);
  }
}

function serializeLoot(room) {
  return Array.from(room.loot.values());
}

function pickupLoot(room, player, lootId) {
  if (!player.alive) return { ok: false, reason: "You are spectating." };
  const item = room.loot.get(lootId);
  if (!item) return { ok: false, reason: "Loot is gone." };
  if (distance2D(player, item) > 5.5) return { ok: false, reason: "Too far from loot." };

  if (item.type === "chest") {
    grantChestReward(player);
  } else if (item.type === "ammoBox") {
    grantAmmoBoxReward(player);
  } else if (item.type === "weapon") {
    addInventoryItem(player, createWeaponInstance(item.weaponId));
  } else if (item.type === "ammo") {
    player.ammo[item.ammoType] = (player.ammo[item.ammoType] || 0) + item.amount;
  } else if (item.type === "materials") {
    player.materials += item.amount;
  } else if (item.type === "shield" || item.type === "heal") {
    addInventoryItem(player, {
      slotType: "consumable",
      instanceId: makeId("item"),
      itemId: item.itemId,
      kind: item.type,
      amount: item.amount,
      name: item.name
    });
  }

  room.loot.delete(item.id);
  return { ok: true, item };
}

function grantChestReward(player) {
  const weaponRoll = Math.random();
  const weaponId = weaponRoll > 0.74 ? "sniper" : weaponRoll > 0.42 ? "shotgun" : "assault";
  addInventoryItem(player, createWeaponInstance(weaponId));
  player.materials += 25 + Math.floor(Math.random() * 35);
  player.ammo.light = (player.ammo.light || 0) + 12 + Math.floor(Math.random() * 16);
  player.ammo.medium = (player.ammo.medium || 0) + 18 + Math.floor(Math.random() * 20);
  player.ammo.shells = (player.ammo.shells || 0) + 4 + Math.floor(Math.random() * 6);
  if (Math.random() > 0.45) {
    const shield = Math.random() > 0.45;
    addInventoryItem(player, {
      slotType: "consumable",
      instanceId: makeId("item"),
      itemId: shield ? "smallShield" : "bandage",
      kind: shield ? "shield" : "heal",
      amount: 25,
      name: shield ? "Small Shield" : "Bandage"
    });
  }
}

function grantAmmoBoxReward(player) {
  player.ammo.light = (player.ammo.light || 0) + 20 + Math.floor(Math.random() * 18);
  player.ammo.medium = (player.ammo.medium || 0) + 24 + Math.floor(Math.random() * 22);
  player.ammo.shells = (player.ammo.shells || 0) + 4 + Math.floor(Math.random() * 8);
  player.ammo.heavy = (player.ammo.heavy || 0) + 2 + Math.floor(Math.random() * 4);
}

function useConsumable(player) {
  const item = player.inventory[player.selectedSlot];
  if (!item || item.slotType !== "consumable") return { ok: false, reason: "No consumable selected." };
  let applied = 0;
  if (item.kind === "shield") {
    const before = player.shield;
    player.shield = Math.min(100, player.shield + item.amount);
    applied = player.shield - before;
  } else if (item.kind === "heal") {
    const before = player.health;
    player.health = Math.min(100, player.health + item.amount);
    applied = player.health - before;
  }
  if (applied <= 0) return { ok: false, reason: "Already full." };
  player.inventory[player.selectedSlot] = null;
  return { ok: true, item, applied };
}

module.exports = {
  FIELD_CONTAINER_POINTS,
  NAMED_LOOT_POINTS,
  pickupLoot,
  serializeLoot,
  spawnLoot,
  useConsumable
};
