const fs = require("fs");
const path = require("path");
const { MAP_SIZE, clamp } = require("./utils");

const MODEL_PATH = path.join(__dirname, "..", "public", "assets", "models", "map.glb");
const GRID_SIZE = 161;
const TARGET_MODEL_SIZE = 292;
const GROUND_OFFSET = 0.45;

let heightfield = null;

function terrainHeightAt(x, z) {
  const field = getHeightfield();
  if (!field) return fallbackTerrainHeightAt(x, z);
  const half = MAP_SIZE / 2;
  const gx = clamp(((x + half) / MAP_SIZE) * (GRID_SIZE - 1), 0, GRID_SIZE - 1);
  const gz = clamp(((z + half) / MAP_SIZE) * (GRID_SIZE - 1), 0, GRID_SIZE - 1);
  const x0 = Math.floor(gx);
  const z0 = Math.floor(gz);
  const x1 = Math.min(GRID_SIZE - 1, x0 + 1);
  const z1 = Math.min(GRID_SIZE - 1, z0 + 1);
  const tx = gx - x0;
  const tz = gz - z0;
  const h00 = sampleCell(field, x0, z0);
  const h10 = sampleCell(field, x1, z0);
  const h01 = sampleCell(field, x0, z1);
  const h11 = sampleCell(field, x1, z1);
  const hx0 = h00 + (h10 - h00) * tx;
  const hx1 = h01 + (h11 - h01) * tx;
  return Math.max(0, Number((hx0 + (hx1 - hx0) * tz + GROUND_OFFSET).toFixed(3)));
}

function getHeightfield() {
  if (heightfield !== null) return heightfield;
  try {
    heightfield = buildHeightfield();
  } catch (error) {
    console.warn(`[Two Weeks] Map heightfield unavailable: ${error.message}`);
    heightfield = false;
  }
  return heightfield;
}

function buildHeightfield() {
  const { json, binary } = readGlb(MODEL_PATH);
  const worldVertices = collectWorldPositions(json, binary);
  if (worldVertices.length < 3) throw new Error("map has no readable POSITION vertices");

  const bounds = computeBounds(worldVertices);
  const horizontalSize = Math.max(bounds.max.x - bounds.min.x, bounds.max.z - bounds.min.z, 1);
  const scale = TARGET_MODEL_SIZE / horizontalSize;
  const centerX = (bounds.min.x + bounds.max.x) / 2;
  const centerZ = (bounds.min.z + bounds.max.z) / 2;

  const cells = new Float32Array(GRID_SIZE * GRID_SIZE);
  cells.fill(Number.NEGATIVE_INFINITY);
  const half = MAP_SIZE / 2;

  for (const vertex of worldVertices) {
    const x = (vertex.x - centerX) * scale;
    const y = (vertex.y - bounds.min.y) * scale;
    const z = (vertex.z - centerZ) * scale;
    if (x < -half || x > half || z < -half || z > half) continue;
    const gx = Math.round(((x + half) / MAP_SIZE) * (GRID_SIZE - 1));
    const gz = Math.round(((z + half) / MAP_SIZE) * (GRID_SIZE - 1));
    const index = gz * GRID_SIZE + gx;
    if (y > cells[index]) cells[index] = y;
  }

  fillMissingCells(cells);
  smoothCells(cells);
  return { cells };
}

function readGlb(filePath) {
  const buffer = fs.readFileSync(filePath);
  if (buffer.toString("ascii", 0, 4) !== "glTF") throw new Error("map.glb is not a GLB file");
  const length = buffer.readUInt32LE(8);
  let offset = 12;
  let json = null;
  let binary = null;
  while (offset < length) {
    const chunkLength = buffer.readUInt32LE(offset);
    const chunkType = buffer.toString("ascii", offset + 4, offset + 8);
    offset += 8;
    if (chunkType === "JSON") {
      json = JSON.parse(buffer.toString("utf8", offset, offset + chunkLength));
    } else if (chunkType === "BIN\0") {
      binary = buffer.subarray(offset, offset + chunkLength);
    }
    offset += chunkLength;
  }
  if (!json || !binary) throw new Error("map.glb is missing JSON or BIN chunks");
  return { json, binary };
}

function collectWorldPositions(json, binary) {
  const positions = [];
  const scene = json.scenes?.[json.scene || 0] || json.scenes?.[0];
  const roots = scene?.nodes || json.nodes?.map((_, index) => index) || [];
  const identity = identityMatrix();
  for (const nodeIndex of roots) {
    walkNode(json, binary, nodeIndex, identity, positions);
  }
  return positions;
}

function walkNode(json, binary, nodeIndex, parentMatrix, positions) {
  const node = json.nodes[nodeIndex];
  if (!node) return;
  const local = nodeMatrix(node);
  const world = multiplyMatrices(parentMatrix, local);
  if (Number.isInteger(node.mesh)) {
    const mesh = json.meshes[node.mesh];
    for (const primitive of mesh?.primitives || []) {
      const accessorIndex = primitive.attributes?.POSITION;
      if (Number.isInteger(accessorIndex)) readPositions(json, binary, accessorIndex, world, positions);
    }
  }
  for (const child of node.children || []) walkNode(json, binary, child, world, positions);
}

function readPositions(json, binary, accessorIndex, matrix, positions) {
  const accessor = json.accessors[accessorIndex];
  const view = json.bufferViews[accessor.bufferView];
  if (!accessor || !view || accessor.componentType !== 5126 || accessor.type !== "VEC3") return;
  const stride = view.byteStride || 12;
  const start = (view.byteOffset || 0) + (accessor.byteOffset || 0);
  for (let i = 0; i < accessor.count; i += 1) {
    const offset = start + i * stride;
    positions.push(transformPoint(matrix, {
      x: binary.readFloatLE(offset),
      y: binary.readFloatLE(offset + 4),
      z: binary.readFloatLE(offset + 8)
    }));
  }
}

function nodeMatrix(node) {
  if (node.matrix) return node.matrix.slice();
  const matrix = identityMatrix();
  if (node.translation) {
    matrix[12] = node.translation[0] || 0;
    matrix[13] = node.translation[1] || 0;
    matrix[14] = node.translation[2] || 0;
  }
  return matrix;
}

function identityMatrix() {
  return [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1
  ];
}

function multiplyMatrices(a, b) {
  const out = new Array(16).fill(0);
  for (let col = 0; col < 4; col += 1) {
    for (let row = 0; row < 4; row += 1) {
      out[col * 4 + row] =
        a[0 * 4 + row] * b[col * 4 + 0] +
        a[1 * 4 + row] * b[col * 4 + 1] +
        a[2 * 4 + row] * b[col * 4 + 2] +
        a[3 * 4 + row] * b[col * 4 + 3];
    }
  }
  return out;
}

function transformPoint(m, p) {
  return {
    x: m[0] * p.x + m[4] * p.y + m[8] * p.z + m[12],
    y: m[1] * p.x + m[5] * p.y + m[9] * p.z + m[13],
    z: m[2] * p.x + m[6] * p.y + m[10] * p.z + m[14]
  };
}

function computeBounds(vertices) {
  const bounds = {
    min: { x: Infinity, y: Infinity, z: Infinity },
    max: { x: -Infinity, y: -Infinity, z: -Infinity }
  };
  for (const vertex of vertices) {
    bounds.min.x = Math.min(bounds.min.x, vertex.x);
    bounds.min.y = Math.min(bounds.min.y, vertex.y);
    bounds.min.z = Math.min(bounds.min.z, vertex.z);
    bounds.max.x = Math.max(bounds.max.x, vertex.x);
    bounds.max.y = Math.max(bounds.max.y, vertex.y);
    bounds.max.z = Math.max(bounds.max.z, vertex.z);
  }
  return bounds;
}

function fillMissingCells(cells) {
  for (let pass = 0; pass < 5; pass += 1) {
    for (let z = 0; z < GRID_SIZE; z += 1) {
      for (let x = 0; x < GRID_SIZE; x += 1) {
        const index = z * GRID_SIZE + x;
        if (Number.isFinite(cells[index])) continue;
        const value = averageNeighbors(cells, x, z);
        if (Number.isFinite(value)) cells[index] = value;
      }
    }
  }
  for (let i = 0; i < cells.length; i += 1) {
    if (!Number.isFinite(cells[i])) cells[i] = fallbackTerrainHeightAt(0, 0);
  }
}

function smoothCells(cells) {
  const copy = new Float32Array(cells);
  for (let z = 1; z < GRID_SIZE - 1; z += 1) {
    for (let x = 1; x < GRID_SIZE - 1; x += 1) {
      const index = z * GRID_SIZE + x;
      const localMax = Math.max(
        copy[index],
        copy[index - 1],
        copy[index + 1],
        copy[index - GRID_SIZE],
        copy[index + GRID_SIZE]
      );
      cells[index] = copy[index] * 0.7 + localMax * 0.3;
    }
  }
}

function averageNeighbors(cells, x, z) {
  let total = 0;
  let count = 0;
  for (let dz = -2; dz <= 2; dz += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      const nx = x + dx;
      const nz = z + dz;
      if (nx < 0 || nz < 0 || nx >= GRID_SIZE || nz >= GRID_SIZE) continue;
      const value = cells[nz * GRID_SIZE + nx];
      if (!Number.isFinite(value)) continue;
      total += value;
      count += 1;
    }
  }
  return count ? total / count : Number.NEGATIVE_INFINITY;
}

function sampleCell(field, x, z) {
  return field.cells[z * GRID_SIZE + x];
}

function fallbackTerrainHeightAt(x, z) {
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
  terrainHeightAt
};
