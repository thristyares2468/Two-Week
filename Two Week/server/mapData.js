const MAP_POIS = [
  {
    name: "Rusty Depot",
    x: -62,
    z: -46,
    radius: 24,
    floor: [[-10, -8], [-5, 7], [3, -10], [9, -2], [12, 9], [-14, 11], [0, 0], [16, -13]],
    chests: [[-13, -11], [-6, 13], [8, 8], [15, -6]],
    ammo: [[-16, 2], [-2, -14], [11, 13], [17, 3]]
  },
  {
    name: "Neon Farm",
    x: 55,
    z: -55,
    radius: 28,
    floor: [[-15, -5], [-9, 12], [-2, -16], [5, 7], [12, -12], [16, 6], [3, 18], [-18, 18], [20, -2]],
    chests: [[-16, -14], [-8, 17], [10, 13], [18, -10]],
    ammo: [[-20, 4], [-3, -20], [9, -4], [18, 15], [24, 2]]
  },
  {
    name: "Signal Hill",
    x: -86,
    z: 55,
    radius: 22,
    floor: [[-9, -8], [-4, 7], [6, -9], [12, 6], [-15, 10], [0, 15], [13, -14]],
    chests: [[-12, -10], [5, 11], [16, -3]],
    ammo: [[-16, 4], [1, -15], [11, 13]]
  },
  {
    name: "Broken Bridge",
    x: 76,
    z: 38,
    radius: 24,
    floor: [[-18, -4], [-10, 8], [-3, -14], [6, 4], [13, -7], [20, 9], [5, 17]],
    chests: [[-18, 11], [3, -18], [18, 4]],
    ammo: [[-21, -5], [-4, 12], [12, -14], [22, 12]]
  },
  {
    name: "Solar Yard",
    x: 8,
    z: -86,
    radius: 26,
    floor: [[-18, -7], [-11, 13], [-3, -17], [6, 7], [12, -11], [19, 3], [2, 20], [-22, 8]],
    chests: [[-17, -15], [-8, 18], [13, 14], [21, -8]],
    ammo: [[-21, 0], [-3, -22], [10, -3], [20, 16]]
  },
  {
    name: "Old Radio Town",
    x: -8,
    z: 10,
    radius: 36,
    floor: [[-24, -18], [-18, 3], [-12, 20], [-5, -10], [2, 4], [8, -22], [13, 18], [20, -6], [25, 11], [0, 26], [-28, 13], [29, -20]],
    chests: [[-25, -18], [-16, 20], [0, 0], [15, 21], [24, -13], [4, -28]],
    ammo: [[-29, 4], [-11, -24], [-3, 18], [11, -6], [23, 8], [30, -2]]
  },
  {
    name: "Quarry Camp",
    x: 92,
    z: -14,
    radius: 28,
    floor: [[-18, -10], [-12, 9], [-2, -19], [8, 3], [14, -12], [21, 10], [4, 19], [-22, 16]],
    chests: [[-19, -14], [-10, 18], [13, 13], [23, -7]],
    ammo: [[-23, 1], [-4, -23], [11, -4], [22, 17]]
  },
  {
    name: "Stormwatch Tower",
    x: -24,
    z: 83,
    radius: 22,
    floor: [[-12, -8], [-5, 10], [4, -13], [10, 5], [15, -4], [-16, 13], [1, 18]],
    chests: [[-14, -11], [2, 12], [16, 6]],
    ammo: [[-18, 2], [-2, -17], [13, 15]]
  },
  {
    name: "Timber Flats",
    x: 45,
    z: 78,
    radius: 26,
    floor: [[-17, -9], [-9, 12], [-2, -17], [7, 6], [13, -11], [20, 8], [3, 20], [-21, 16]],
    chests: [[-18, -13], [-7, 18], [12, 14], [21, -7]],
    ammo: [[-22, 1], [-4, -22], [10, -3], [21, 16]]
  },
  {
    name: "Blue Barns",
    x: -95,
    z: -10,
    radius: 26,
    floor: [[-16, -9], [-10, 12], [-2, -18], [6, 4], [14, -10], [19, 8], [3, 19], [-22, 15]],
    chests: [[-18, -13], [-8, 18], [11, 14], [20, -7]],
    ammo: [[-22, 2], [-4, -22], [10, -4], [21, 15]]
  },
  {
    name: "Tidewalk Pier",
    x: 112,
    z: 90,
    radius: 20,
    floor: [[-12, -6], [-6, 8], [3, -11], [10, 3], [15, 10], [-16, 13]],
    chests: [[-14, -10], [6, 12], [16, -2]],
    ammo: [[-17, 2], [0, -15], [13, 10]]
  },
  {
    name: "Misty Works",
    x: -118,
    z: 86,
    radius: 20,
    floor: [[-10, -8], [-4, 9], [5, -10], [12, 5], [-15, 12], [2, 16]],
    chests: [[-13, -11], [5, 12], [15, -1]],
    ammo: [[-17, 1], [0, -15], [12, 11]]
  }
];

const FIELD_LOOT_ANCHORS = [
  { x: -128, z: -96 }, { x: -126, z: 16 }, { x: -116, z: 122 },
  { x: -84, z: -112 }, { x: -60, z: 116 }, { x: -32, z: -128 },
  { x: -4, z: 54 }, { x: 18, z: 126 }, { x: 36, z: -124 },
  { x: 64, z: 18 }, { x: 82, z: -102 }, { x: 104, z: 118 },
  { x: 125, z: -62 }, { x: 132, z: 26 }, { x: 6, z: -136 },
  { x: -140, z: -34 }, { x: 139, z: 72 }, { x: 72, z: -4 }
];

const FIELD_CONTAINERS = [
  { x: -135, z: -82, type: "chest", source: "field bunker" },
  { x: -128, z: 72, type: "ammoBox", source: "field bunker" },
  { x: 126, z: -74, type: "ammoBox", source: "roadside cache" },
  { x: 118, z: 80, type: "chest", source: "pier cache" },
  { x: -36, z: -124, type: "chest", source: "south outpost" },
  { x: 40, z: 122, type: "ammoBox", source: "timber trail" },
  { x: 0, z: 52, type: "supplyCrate", source: "central drop" },
  { x: 64, z: -4, type: "ammoBox", source: "crossroads" }
];

const STATIC_COLLIDERS = [
  box("Rusty Depot warehouse", -65, -47, 19, 8, 13),
  box("Rusty Depot loading shed", -47, -38, 10, 5, 8),
  box("Neon Farm barn", 46, -61, 16, 10, 14),
  box("Neon Farm silo", 65, -45, 8, 13, 8),
  box("Signal Hill station", -88, 53, 14, 7, 11),
  box("Signal Hill mast", -76, 64, 5, 22, 5),
  box("Broken Bridge west pylon", 60, 34, 8, 11, 11),
  box("Broken Bridge east pylon", 91, 43, 8, 11, 11),
  box("Solar Yard control room", -4, -89, 16, 7, 12),
  box("Solar Yard inverter bank", 18, -77, 18, 4, 7),
  box("Old Radio Town block north", -18, 22, 18, 9, 14),
  box("Old Radio Town block middle", 4, 4, 22, 10, 16),
  box("Old Radio Town block east", 22, 15, 16, 8, 12),
  box("Old Radio Town tower", -6, -14, 6, 24, 6),
  box("Quarry Camp crusher", 82, -24, 18, 9, 13),
  box("Quarry Camp office", 102, -5, 15, 7, 11),
  box("Stormwatch tower base", -25, 82, 9, 26, 9),
  box("Timber Flats mill", 40, 72, 19, 8, 14),
  box("Timber Flats log stack", 62, 88, 18, 4, 7),
  box("Blue Barns main barn", -99, -15, 19, 10, 15),
  box("Blue Barns shed", -78, 3, 13, 6, 9),
  box("Tidewalk Pier shop", 108, 90, 16, 7, 10),
  box("Tidewalk Pier crane", 127, 101, 7, 18, 7),
  box("Misty Works cabin", -117, 85, 16, 7, 12),
  box("Misty Works tank", -132, 96, 8, 10, 8)
];

function box(name, x, z, width, height, depth, y = 0) {
  return { name, x, y, z, width, height, depth };
}

function makeAnchors(poi, key, type) {
  return poi[key].map(([dx, dz], index) => ({
    id: `${poi.name}:${type}:${index}`,
    type,
    source: poi.name,
    x: Number((poi.x + dx).toFixed(2)),
    z: Number((poi.z + dz).toFixed(2))
  }));
}

const LOOT_ZONES = MAP_POIS.map((poi) => ({
  name: poi.name,
  x: poi.x,
  z: poi.z,
  radius: poi.radius,
  floorLoot: makeAnchors(poi, "floor", "floorLoot"),
  chests: makeAnchors(poi, "chests", "chest"),
  ammoBoxes: makeAnchors(poi, "ammo", "ammoBox")
}));

function terrainHeightAt(x, z) {
  const hills = [
    { x: -86, z: 55, r: 54, h: 4.2 },
    { x: -24, z: 83, r: 40, h: 3.4 },
    { x: 92, z: -14, r: 48, h: 2.2 },
    { x: 8, z: -86, r: 58, h: 1.6 }
  ];
  let height = Math.sin(x * 0.035) * 0.22 + Math.cos(z * 0.03) * 0.18;
  for (const hill of hills) {
    const d = Math.hypot(x - hill.x, z - hill.z);
    const t = Math.max(0, 1 - d / hill.r);
    height += hill.h * t * t;
  }
  return Math.max(0, Number(height.toFixed(3)));
}

module.exports = {
  FIELD_CONTAINERS,
  FIELD_LOOT_ANCHORS,
  LOOT_ZONES,
  MAP_POIS,
  STATIC_COLLIDERS,
  terrainHeightAt
};
