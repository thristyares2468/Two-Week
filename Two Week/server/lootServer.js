const {
  WEAPON_STATS,
  createWeaponInstance,
  distance2D,
  makeId,
  randomFloat
} = require("./utils");
const { addInventoryItem } = require("./playerState");
const { FIELD_CONTAINERS, FIELD_LOOT_ANCHORS, LOOT_ZONES } = require("./mapData");

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
    rotation: Number((position.rotation || randomFloat(0, Math.PI * 2)).toFixed(4)),
    createdAt: Date.now()
  };
  if (template.type === "chest" || template.type === "ammoBox" || template.type === "supplyCrate") {
    item.name = template.type === "chest" ? "Chest" : template.type === "ammoBox" ? "Ammo Box" : "Supply Crate";
    item.container = true;
    item.y = template.type === "chest" ? 0.8 : template.type === "supplyCrate" ? 1.05 : 0.55;
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
  const sandboxScale = room.roomType === "sandbox" ? 0.45 : 1;
  for (const zone of LOOT_ZONES) {
    const floorCount = Math.max(2, Math.ceil(zone.floorLoot.length * sandboxScale));
    for (let i = 0; i < floorCount; i += 1) {
      const anchor = zone.floorLoot[i];
      const item = createLootItem(weightedLoot(), jitterAnchor(anchor, 1.35), zone.name);
      room.loot.set(item.id, item);
    }
    for (const anchor of zone.chests.slice(0, Math.ceil(zone.chests.length * sandboxScale))) {
      const item = createLootItem({ type: "chest" }, jitterAnchor(anchor, 0.75), zone.name);
      room.loot.set(item.id, item);
    }
    for (const anchor of zone.ammoBoxes.slice(0, Math.ceil(zone.ammoBoxes.length * sandboxScale))) {
      const item = createLootItem({ type: "ammoBox" }, jitterAnchor(anchor, 0.75), zone.name);
      room.loot.set(item.id, item);
    }
  }
  for (const anchor of FIELD_LOOT_ANCHORS) {
    const item = createLootItem(weightedLoot(), jitterAnchor(anchor, 2.6), "field");
    room.loot.set(item.id, item);
  }
  for (const point of FIELD_CONTAINERS) {
    const item = createLootItem({ type: point.type }, jitterAnchor(point, 0.8), point.source || "field");
    room.loot.set(item.id, item);
  }
}

function jitterAnchor(anchor, amount) {
  return {
    x: anchor.x + randomFloat(-amount, amount),
    z: anchor.z + randomFloat(-amount, amount),
    rotation: randomFloat(0, Math.PI * 2)
  };
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
  } else if (item.type === "supplyCrate") {
    grantSupplyCrateReward(player);
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

function grantSupplyCrateReward(player) {
  const weaponChoices = ["assault", "shotgun", "sniper"];
  const grantShield = Math.random() > 0.5;
  addInventoryItem(player, createWeaponInstance(weaponChoices[Math.floor(Math.random() * weaponChoices.length)]));
  addInventoryItem(player, {
    slotType: "consumable",
    instanceId: makeId("item"),
    itemId: grantShield ? "smallShield" : "medkit",
    kind: grantShield ? "shield" : "heal",
    amount: 70,
    name: grantShield ? "Big Shield" : "Medkit"
  });
  player.materials += 80;
  player.ammo.light = (player.ammo.light || 0) + 48;
  player.ammo.medium = (player.ammo.medium || 0) + 72;
  player.ammo.shells = (player.ammo.shells || 0) + 12;
  player.ammo.heavy = (player.ammo.heavy || 0) + 8;
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
  FIELD_CONTAINERS,
  LOOT_ZONES,
  pickupLoot,
  serializeLoot,
  spawnLoot,
  useConsumable
};
