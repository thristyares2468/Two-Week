export const WEAPON_STATS = {
  pistol: {
    id: "pistol",
    name: "Pistol",
    rarity: "Common",
    ammoType: "light",
    magazineSize: 12,
    color: "#dbeafe"
  },
  assault: {
    id: "assault",
    name: "Assault Rifle",
    rarity: "Uncommon",
    ammoType: "medium",
    magazineSize: 30,
    color: "#86efac"
  },
  shotgun: {
    id: "shotgun",
    name: "Scatter Shotgun",
    rarity: "Rare",
    ammoType: "shells",
    magazineSize: 6,
    color: "#93c5fd"
  },
  sniper: {
    id: "sniper",
    name: "Longview Rifle",
    rarity: "Epic",
    ammoType: "heavy",
    magazineSize: 4,
    color: "#c084fc"
  }
};

export function getWeaponLabel(item) {
  if (!item) return "Empty";
  if (item.slotType === "consumable") return item.name || item.itemId || "Item";
  const stats = WEAPON_STATS[item.weaponId];
  return stats ? stats.name : "Weapon";
}

export function getAmmoLabel(self) {
  const item = self && self.inventory ? self.inventory[self.selectedSlot] : null;
  if (!item || item.slotType !== "weapon") return "--";
  const stats = WEAPON_STATS[item.weaponId];
  if (!stats) return "--";
  return `${item.ammoInMag} / ${self.ammo[stats.ammoType] || 0}`;
}
