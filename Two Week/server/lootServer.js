const {
  CONSUMABLE_STATS,
  WEAPON_STATS,
  createConsumableInstance,
  createWeaponInstance,
  distance2D,
  makeId,
  groundLootY,
  randomFloat,
  randomPointInCircle
} = require("./utils");
const { addInventoryItem, applyDamage } = require("./playerState");

const WEAPON_LOOT = [
  ["pistol_common", 7], ["pistol_uncommon", 5], ["pistol_rare", 3], ["pistol_epic", 1.4], ["pistol_legendary", 0.8],
  ["smg_common", 8], ["smg_uncommon", 6], ["smg_rare", 4], ["smg_epic", 1.8], ["smg_legendary", 1],
  ["assault_rifle_common", 8], ["assault_rifle_uncommon", 7], ["assault_rifle_rare", 4.5], ["assault_rifle_epic", 2], ["assault_rifle_legendary", 1.1],
  ["burst_assault_common", 6], ["burst_assault_uncommon", 5], ["burst_assault_rare", 3.6], ["burst_assault_epic", 1.7], ["burst_assault_legendary", 0.9],
  ["pump_shotgun_common", 6], ["pump_shotgun_uncommon", 5], ["pump_shotgun_rare", 3.7], ["pump_shotgun_epic", 1.5], ["pump_shotgun_legendary", 0.85],
  ["tactical_shotgun_common", 6], ["tactical_shotgun_uncommon", 5], ["tactical_shotgun_rare", 3.6], ["tactical_shotgun_epic", 1.4], ["tactical_shotgun_legendary", 0.8],
  ["bolt_sniper_common", 2.3], ["bolt_sniper_uncommon", 2], ["bolt_sniper_rare", 1.5], ["bolt_sniper_epic", 0.85], ["bolt_sniper_legendary", 0.45],
  ["rocket_launcher_rare", 0.75], ["rocket_launcher_epic", 0.4], ["rocket_launcher_legendary", 0.22],
  ["bandage_launcher_rare", 0.45]
];

const CHEST_WEAPON_LOOT = WEAPON_LOOT.map(([weaponId, weight]) => {
  const rarity = WEAPON_STATS[weaponId] && WEAPON_STATS[weaponId].rarity;
  const bonus = rarity === "Legendary" ? 2.4 : rarity === "Epic" ? 2 : rarity === "Rare" ? 1.35 : 0.7;
  return [weaponId, weight * bonus];
});

const LOOT_TABLE = [
  ...WEAPON_LOOT.map(([weaponId, weight]) => ({ type: "weapon", weaponId, weight })),
  { type: "ammo", ammoType: "light", amount: 24, weight: 14 },
  { type: "ammo", ammoType: "medium", amount: 30, weight: 14 },
  { type: "ammo", ammoType: "shells", amount: 8, weight: 10 },
  { type: "ammo", ammoType: "heavy", amount: 5, weight: 7 },
  { type: "ammo", ammoType: "rockets", amount: 1, weight: 1.8 },
  { type: "materials", amount: 35, weight: 13 },
  { type: "consumable", itemId: "smallShield", count: 1, weight: 8 },
  { type: "consumable", itemId: "shieldPotion", count: 1, weight: 4.4 },
  { type: "consumable", itemId: "bandage", count: 3, weight: 8 },
  { type: "consumable", itemId: "medkit", count: 1, weight: 3.4 },
  { type: "consumable", itemId: "grenade", count: 3, weight: 5 },
  { type: "consumable", itemId: "fishingRod", count: 1, weight: 2.2 }
];

const LOOT_COORD_SCALE = 1.7;

const NAMED_LOOT_POINTS = [
  { name: "Craggy Cliffs", x: 8, z: -122, chest: 3, ammoBoxes: 3 },
  { name: "Pleasant Park", x: -52, z: -84, chest: 4, ammoBoxes: 4 },
  { name: "Steamy Stacks", x: 82, z: -88, chest: 4, ammoBoxes: 4 },
  { name: "Sweaty Sands", x: -104, z: -52, chest: 3, ammoBoxes: 4 },
  { name: "Frenzy Farm", x: 18, z: -42, chest: 5, ammoBoxes: 5 },
  { name: "Dirty Docks", x: 106, z: -20, chest: 4, ammoBoxes: 5 },
  { name: "Salty Springs", x: -34, z: -12, chest: 3, ammoBoxes: 3 },
  { name: "Holly Hedges", x: -88, z: 18, chest: 3, ammoBoxes: 3 },
  { name: "Weeping Woods", x: -42, z: 38, chest: 4, ammoBoxes: 4 },
  { name: "Retail Row", x: 86, z: 38, chest: 4, ammoBoxes: 4 },
  { name: "Lazy Lake", x: 48, z: 54, chest: 4, ammoBoxes: 4 },
  { name: "Slurpy Swamp", x: -66, z: 88, chest: 4, ammoBoxes: 4 },
  { name: "Misty Meadows", x: 28, z: 110, chest: 4, ammoBoxes: 4 }
];

const FIELD_CONTAINER_POINTS = [
  { x: -205, z: -132, type: "chest" },
  { x: -210, z: 126, type: "ammoBox" },
  { x: 210, z: -124, type: "ammoBox" },
  { x: 198, z: 136, type: "chest" },
  { x: -62, z: -210, type: "chest" },
  { x: 70, z: 210, type: "ammoBox" },
  { x: 0, z: 92, type: "chest" },
  { x: 112, z: -8, type: "ammoBox" }
];

function weightedChoice(table) {
  const total = table.reduce((sum, item) => sum + (Array.isArray(item) ? item[1] : item.weight), 0);
  let roll = Math.random() * total;
  for (const item of table) {
    const weight = Array.isArray(item) ? item[1] : item.weight;
    roll -= weight;
    if (roll <= 0) return Array.isArray(item) ? item[0] : item;
  }
  const fallback = table[0];
  return Array.isArray(fallback) ? fallback[0] : fallback;
}

function weightedLoot() {
  return weightedChoice(LOOT_TABLE);
}

function createLootItem(template, position, source = "ground") {
  const item = {
    id: makeId("loot"),
    type: template.type,
    x: Number(position.x.toFixed(2)),
    y: groundLootY(position.x, position.z, 0.9),
    z: Number(position.z.toFixed(2)),
    source,
    createdAt: Date.now()
  };
  if (template.type === "chest" || template.type === "ammoBox") {
    item.name = template.type === "chest" ? "Chest" : "Ammo Box";
    item.container = true;
    item.y = groundLootY(position.x, position.z, template.type === "chest" ? 1.25 : 0.9);
  } else if (template.type === "weapon") {
    const stats = WEAPON_STATS[template.weaponId] || WEAPON_STATS.pistol_common;
    item.weaponId = stats.id;
    item.name = stats.name;
    item.rarity = stats.rarity;
    item.color = stats.color;
  } else if (template.type === "ammo") {
    item.ammoType = template.ammoType;
    item.amount = template.amount;
    item.name = template.ammoType + " ammo";
  } else if (template.type === "materials") {
    item.amount = template.amount;
    item.name = "Materials";
  } else if (template.type === "consumable") {
    const stats = CONSUMABLE_STATS[template.itemId] || CONSUMABLE_STATS.smallShield;
    item.type = stats.kind;
    item.itemId = stats.itemId;
    item.kind = stats.kind;
    item.amount = stats.amount || 0;
    item.damage = stats.damage || 0;
    item.radius = stats.radius || 0;
    item.count = template.count || 1;
    item.name = stats.name;
    item.rarity = stats.rarity;
    item.color = stats.color;
  }
  return item;
}

function spawnLoot(room) {
  room.loot.clear();
  for (const point of NAMED_LOOT_POINTS) {
    const baseX = point.x * LOOT_COORD_SCALE;
    const baseZ = point.z * LOOT_COORD_SCALE;
    const count = room.roomType === "sandbox" ? 3 : 7;
    for (let i = 0; i < count; i += 1) {
      const pos = {
        x: baseX + randomFloat(-20, 20),
        z: baseZ + randomFloat(-20, 20)
      };
      const item = createLootItem(weightedLoot(), pos, point.name);
      room.loot.set(item.id, item);
    }
    const containerScale = room.roomType === "sandbox" ? 0.6 : 1;
    for (let i = 0; i < Math.ceil(point.chest * containerScale); i += 1) {
      const pos = {
        x: baseX + randomFloat(-26, 26),
        z: baseZ + randomFloat(-26, 26)
      };
      const item = createLootItem({ type: "chest" }, pos, point.name);
      room.loot.set(item.id, item);
    }
    for (let i = 0; i < Math.ceil(point.ammoBoxes * containerScale); i += 1) {
      const pos = {
        x: baseX + randomFloat(-30, 30),
        z: baseZ + randomFloat(-30, 30)
      };
      const item = createLootItem({ type: "ammoBox" }, pos, point.name);
      room.loot.set(item.id, item);
    }
  }
  for (let i = 0; i < 44; i += 1) {
    const pos = randomPointInCircle(226);
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
    grantAmmoForWeapon(player, item.weaponId, 0.45);
  } else if (item.type === "ammo") {
    player.ammo[item.ammoType] = (player.ammo[item.ammoType] || 0) + item.amount;
  } else if (item.type === "materials") {
    player.materials += item.amount;
  } else if (item.itemId) {
    addInventoryItem(player, createConsumableInstance(item.itemId, item.count || 1));
  }

  room.loot.delete(item.id);
  return { ok: true, item };
}

function grantAmmoForWeapon(player, weaponId, scale = 1) {
  const stats = WEAPON_STATS[weaponId];
  if (!stats || stats.ammoType === "charges") return;
  const amountByType = {
    light: 30,
    medium: 36,
    shells: 10,
    heavy: 5,
    rockets: 1
  };
  const amount = Math.max(1, Math.round((amountByType[stats.ammoType] || 12) * scale));
  player.ammo[stats.ammoType] = (player.ammo[stats.ammoType] || 0) + amount;
}

function grantChestReward(player) {
  const weaponId = weightedChoice(CHEST_WEAPON_LOOT);
  addInventoryItem(player, createWeaponInstance(weaponId));
  grantAmmoForWeapon(player, weaponId, 1.15);
  player.materials += 25 + Math.floor(Math.random() * 35);
  if (Math.random() > 0.35) {
    const itemId = weightedChoice([
      ["smallShield", 5],
      ["shieldPotion", 2.7],
      ["bandage", 3.3],
      ["medkit", 1.8],
      ["grenade", 2.1],
      ["fishingRod", 0.8]
    ]);
    addInventoryItem(player, createConsumableInstance(itemId, itemId === "bandage" ? 3 : itemId === "grenade" ? 3 : 1));
  }
}

function grantAmmoBoxReward(player) {
  player.ammo.light = (player.ammo.light || 0) + 20 + Math.floor(Math.random() * 18);
  player.ammo.medium = (player.ammo.medium || 0) + 24 + Math.floor(Math.random() * 22);
  player.ammo.shells = (player.ammo.shells || 0) + 4 + Math.floor(Math.random() * 8);
  player.ammo.heavy = (player.ammo.heavy || 0) + 2 + Math.floor(Math.random() * 4);
  if (Math.random() > 0.72) player.ammo.rockets = (player.ammo.rockets || 0) + 1;
}

function consumeSelected(player, item) {
  item.count = (item.count || 1) - 1;
  if (item.count <= 0) player.inventory[player.selectedSlot] = null;
}

function useConsumable(room, player) {
  const item = player.inventory[player.selectedSlot];
  if (!item || item.slotType !== "consumable") return { ok: false, reason: "No consumable selected." };
  let applied = 0;
  if (item.kind === "shield") {
    const before = player.shield;
    player.shield = Math.min(item.maxShield || 100, player.shield + item.amount);
    applied = player.shield - before;
  } else if (item.kind === "heal") {
    const before = player.health;
    player.health = Math.min(item.maxHealth || 100, player.health + item.amount);
    applied = player.health - before;
  } else if (item.kind === "explosive") {
    const explosion = throwGrenade(room, player, item);
    consumeSelected(player, item);
    return { ok: true, item, applied: 0, explosion, hits: explosion.hits };
  } else if (item.kind === "utility") {
    return { ok: true, item, applied: 0, message: "No fishing spot here yet." };
  }
  if (applied <= 0) return { ok: false, reason: "Already full." };
  consumeSelected(player, item);
  return { ok: true, item, applied };
}

function throwGrenade(room, player, item) {
  const radius = item.radius || 7.5;
  const center = {
    x: player.x + Math.sin(player.yaw) * 13,
    y: player.y + 1.2,
    z: player.z + Math.cos(player.yaw) * 13
  };
  const hits = [];
  const candidates = [...room.players.values(), ...room.dummies];
  for (const target of candidates) {
    if (!target.alive || target.id === player.id) continue;
    const d = distance2D(target, center);
    if (d > radius) continue;
    const falloff = 1 - d / radius * 0.45;
    const damage = Math.max(1, Math.round((item.damage || 100) * falloff));
    const outcome = applyDamage(target, damage, player, "grenade", room);
    hits.push({
      type: "player",
      targetId: target.id,
      damage,
      shieldDamage: Math.round(outcome.shieldDamage),
      healthDamage: Math.round(outcome.healthDamage),
      eliminated: outcome.eliminated,
      distance: d
    });
  }
  return { center, radius, hits };
}

module.exports = {
  FIELD_CONTAINER_POINTS,
  LOOT_TABLE,
  NAMED_LOOT_POINTS,
  pickupLoot,
  serializeLoot,
  spawnLoot,
  useConsumable
};
