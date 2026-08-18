/**
 * OBJ to GLB Converter — Full Quality
 * No decimation, no texture compression.
 * Embeds the original texture PNG directly into the GLB.
 *
 * Pure Node.js — no external dependencies needed.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// ─── CONFIGURATION ───
const INPUT_OBJ = 'G:\\Outros computadores\\O meu portátil\\Malha Viva\\3D\\Mapa\\Modelos\\Mapeamento simplificado + domo\\Mapeamento Simplificado.obj';
const INPUT_TEXTURE = 'G:\\Outros computadores\\O meu portátil\\Malha Viva\\3D\\Mapa\\Modelos\\Mapeamento simplificado + domo\\Mapeamento Simplificado_u1_v1_diffuse.png';
const OUTPUT_GLB = path.join(__dirname, '..', 'public', 'models', 'mapa.glb');
const DECIMATION_FACTOR = 1; // 1 = keep ALL faces (no decimation)

console.log('╔══════════════════════════════════════════════════════╗');
console.log('║   OBJ → GLB Converter — Full Quality + Texture     ║');
console.log('╚══════════════════════════════════════════════════════╝');
console.log('');
console.log(`Input OBJ:     ${INPUT_OBJ}`);
console.log(`Input Texture: ${INPUT_TEXTURE}`);
console.log(`Output:        ${OUTPUT_GLB}`);
console.log(`Decimation:    NONE (keeping all faces)`);
console.log('');

// ─── PHASE 1: Parse OBJ ───
async function parseOBJ() {
  console.log('Phase 1/4: Parsing OBJ file...');

  const vertices = [];
  const normals = [];
  const uvs = [];
  const rawFaces = [];

  const fileStream = fs.createReadStream(INPUT_OBJ, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let lineCount = 0;
  const startTime = Date.now();

  for await (const line of rl) {
    lineCount++;
    if (lineCount % 2000000 === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`  ... ${lineCount.toLocaleString()} lines (${elapsed}s) — v:${vertices.length.toLocaleString()} f:${rawFaces.length.toLocaleString()}`);
    }

    const trimmed = line.trim();
    if (!trimmed || trimmed[0] === '#' || trimmed.startsWith('mtllib') || trimmed.startsWith('usemtl') || trimmed.startsWith('o ') || trimmed.startsWith('g ') || trimmed.startsWith('s ')) continue;

    if (trimmed.startsWith('v ')) {
      const parts = trimmed.split(/\s+/);
      vertices.push(parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3]));
    } else if (trimmed.startsWith('vn ')) {
      const parts = trimmed.split(/\s+/);
      normals.push(parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3]));
    } else if (trimmed.startsWith('vt ')) {
      const parts = trimmed.split(/\s+/);
      uvs.push(parseFloat(parts[1]), parseFloat(parts[2]));
    } else if (trimmed.startsWith('f ')) {
      const parts = trimmed.split(/\s+/).slice(1);
      const face = [];
      for (const p of parts) {
        const indices = p.split('/');
        face.push({
          v: parseInt(indices[0]) - 1,
          vt: indices[1] ? parseInt(indices[1]) - 1 : -1,
          vn: indices[2] ? parseInt(indices[2]) - 1 : -1
        });
      }
      rawFaces.push(face);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`  Done parsing in ${elapsed}s`);
  console.log(`  Vertices: ${(vertices.length / 3).toLocaleString()}`);
  console.log(`  Normals:  ${(normals.length / 3).toLocaleString()}`);
  console.log(`  UVs:      ${(uvs.length / 2).toLocaleString()}`);
  console.log(`  Faces:    ${rawFaces.length.toLocaleString()}`);
  console.log('');

  return { vertices, normals, uvs, rawFaces };
}

// ─── PHASE 2: Build Indexed Geometry (no decimation) ───
function buildGeometry(data) {
  console.log('Phase 2/4: Building geometry (no decimation)...');
  const startTime = Date.now();

  const { vertices, normals, uvs, rawFaces } = data;
  const hasNormals = normals.length > 0;
  const hasUVs = uvs.length > 0;

  // Keep all faces
  const keptFaces = DECIMATION_FACTOR <= 1
    ? rawFaces
    : rawFaces.filter((_, i) => i % DECIMATION_FACTOR === 0);

  console.log(`  Faces to process: ${keptFaces.length.toLocaleString()}`);

  const vertexMap = new Map();
  const outPositions = [];
  const outNormals = [];
  const outUVs = [];
  const outIndices = [];
  let nextIndex = 0;

  function getOrCreateVertex(fv) {
    const key = `${fv.v}/${fv.vt}/${fv.vn}`;
    let idx = vertexMap.get(key);
    if (idx !== undefined) return idx;

    idx = nextIndex++;
    vertexMap.set(key, idx);

    const vi = fv.v * 3;
    outPositions.push(vertices[vi], vertices[vi + 1], vertices[vi + 2]);

    if (hasNormals && fv.vn >= 0) {
      const ni = fv.vn * 3;
      outNormals.push(normals[ni], normals[ni + 1], normals[ni + 2]);
    } else if (hasNormals) {
      outNormals.push(0, 1, 0);
    }

    if (hasUVs && fv.vt >= 0) {
      const ti = fv.vt * 2;
      outUVs.push(uvs[ti], uvs[ti + 1]);
    } else if (hasUVs) {
      outUVs.push(0, 0);
    }

    return idx;
  }

  for (let fi = 0; fi < keptFaces.length; fi++) {
    const face = keptFaces[fi];
    if (face.length < 3) continue;

    const i0 = getOrCreateVertex(face[0]);
    for (let j = 1; j < face.length - 1; j++) {
      const i1 = getOrCreateVertex(face[j]);
      const i2 = getOrCreateVertex(face[j + 1]);
      outIndices.push(i0, i1, i2);
    }

    if (fi % 500000 === 0 && fi > 0) {
      console.log(`  ... processed ${fi.toLocaleString()} / ${keptFaces.length.toLocaleString()} faces`);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`  Output vertices: ${(outPositions.length / 3).toLocaleString()}`);
  console.log(`  Output triangles: ${(outIndices.length / 3).toLocaleString()}`);
  console.log(`  Done in ${elapsed}s`);
  console.log('');

  // Compute bounding box
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < outPositions.length; i += 3) {
    const x = outPositions[i], y = outPositions[i + 1], z = outPositions[i + 2];
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }

  return {
    positions: new Float32Array(outPositions),
    normals: hasNormals ? new Float32Array(outNormals) : null,
    uvs: hasUVs ? new Float32Array(outUVs) : null,
    indices: outIndices,
    vertexCount: outPositions.length / 3,
    triangleCount: outIndices.length / 3,
    min: [minX, minY, minZ],
    max: [maxX, maxY, maxZ]
  };
}

// ─── PHASE 3: Read Texture ───
function readTexture() {
  console.log('Phase 3/4: Reading texture file...');

  if (!fs.existsSync(INPUT_TEXTURE)) {
    console.log('  WARNING: Texture file not found, GLB will have no texture.');
    return null;
  }

  const textureBuffer = fs.readFileSync(INPUT_TEXTURE);
  const ext = path.extname(INPUT_TEXTURE).toLowerCase();
  const mimeType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';

  console.log(`  Texture: ${INPUT_TEXTURE}`);
  console.log(`  Size: ${(textureBuffer.length / (1024 * 1024)).toFixed(1)} MB`);
  console.log(`  MIME: ${mimeType}`);
  console.log('');

  return { buffer: textureBuffer, mimeType };
}

// ─── PHASE 4: Write GLB ───
function writeGLB(geometry, texture) {
  console.log('Phase 4/4: Writing GLB file...');
  const startTime = Date.now();

  const { positions, normals, uvs, indices, vertexCount, triangleCount, min, max } = geometry;

  // Determine index type
  const useUint32 = vertexCount > 65535;
  const indexComponentType = useUint32 ? 5125 : 5123;
  const indexBytes = useUint32 ? 4 : 2;

  // Build binary buffer
  const posBuffer = Buffer.from(positions.buffer);
  const normalBuffer = normals ? Buffer.from(normals.buffer) : null;
  const uvBuffer = uvs ? Buffer.from(uvs.buffer) : null;

  let indexBuffer;
  if (useUint32) {
    const arr = new Uint32Array(indices);
    indexBuffer = Buffer.from(arr.buffer);
  } else {
    const arr = new Uint16Array(indices);
    indexBuffer = Buffer.from(arr.buffer);
  }

  // Calculate buffer offsets with padding
  let totalBinSize = 0;
  const bufferViews = [];
  const accessors = [];

  // 0: Indices
  const indicesOffset = totalBinSize;
  const indicesLength = indexBuffer.length;
  bufferViews.push({
    buffer: 0,
    byteOffset: indicesOffset,
    byteLength: indicesLength,
    target: 34963
  });

  let idxMin = indices[0], idxMax = indices[0];
  for (let i = 1; i < indices.length; i++) {
    if (indices[i] < idxMin) idxMin = indices[i];
    if (indices[i] > idxMax) idxMax = indices[i];
  }

  accessors.push({
    bufferView: 0,
    byteOffset: 0,
    componentType: indexComponentType,
    count: indices.length,
    type: 'SCALAR',
    max: [idxMax],
    min: [idxMin]
  });
  totalBinSize += indicesLength;
  totalBinSize = align4(totalBinSize);

  // 1: Positions
  const posOffset = totalBinSize;
  const posLength = posBuffer.length;
  bufferViews.push({
    buffer: 0,
    byteOffset: posOffset,
    byteLength: posLength,
    target: 34962
  });
  accessors.push({
    bufferView: 1,
    byteOffset: 0,
    componentType: 5126,
    count: vertexCount,
    type: 'VEC3',
    max: max,
    min: min
  });
  totalBinSize += posLength;
  totalBinSize = align4(totalBinSize);

  let nextBufViewIdx = 2;
  let attributes = { POSITION: 1 };

  // 2: Normals (optional)
  if (normalBuffer) {
    const normalOffset = totalBinSize;
    bufferViews.push({
      buffer: 0,
      byteOffset: normalOffset,
      byteLength: normalBuffer.length,
      target: 34962
    });
    accessors.push({
      bufferView: nextBufViewIdx,
      byteOffset: 0,
      componentType: 5126,
      count: vertexCount,
      type: 'VEC3'
    });
    attributes.NORMAL = nextBufViewIdx;
    nextBufViewIdx++;
    totalBinSize += normalBuffer.length;
    totalBinSize = align4(totalBinSize);
  }

  // 3: UVs (optional)
  if (uvBuffer) {
    const uvOffset = totalBinSize;
    bufferViews.push({
      buffer: 0,
      byteOffset: uvOffset,
      byteLength: uvBuffer.length,
      target: 34962
    });
    accessors.push({
      bufferView: nextBufViewIdx,
      byteOffset: 0,
      componentType: 5126,
      count: vertexCount,
      type: 'VEC2'
    });
    attributes.TEXCOORD_0 = nextBufViewIdx;
    nextBufViewIdx++;
    totalBinSize += uvBuffer.length;
    totalBinSize = align4(totalBinSize);
  }

  // 4: Texture image (optional)
  let textureBufViewIdx = -1;
  if (texture) {
    const textureOffset = totalBinSize;
    bufferViews.push({
      buffer: 0,
      byteOffset: textureOffset,
      byteLength: texture.buffer.length
      // No target — this is an image, not a vertex attribute
    });
    textureBufViewIdx = nextBufViewIdx;
    nextBufViewIdx++;
    totalBinSize += texture.buffer.length;
    totalBinSize = align4(totalBinSize);
  }

  // Build glTF JSON
  const material = {
    pbrMetallicRoughness: {
      metallicFactor: 0.0,
      roughnessFactor: 0.85
    },
    doubleSided: true
  };

  if (texture) {
    material.pbrMetallicRoughness.baseColorFactor = [1.0, 1.0, 1.0, 1.0];
    material.pbrMetallicRoughness.baseColorTexture = { index: 0 };
  } else {
    material.pbrMetallicRoughness.baseColorFactor = [0.65, 0.65, 0.72, 1.0];
  }

  const gltfJson = {
    asset: {
      version: '2.0',
      generator: 'MalhaViva OBJ-to-GLB Converter (Full Quality)'
    },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{
      primitives: [{
        attributes: attributes,
        indices: 0,
        material: 0
      }]
    }],
    materials: [material],
    accessors: accessors,
    bufferViews: bufferViews,
    buffers: [{ byteLength: totalBinSize }]
  };

  // Add texture-related entries if we have a texture
  if (texture) {
    gltfJson.textures = [{
      sampler: 0,
      source: 0
    }];
    gltfJson.images = [{
      bufferView: textureBufViewIdx,
      mimeType: texture.mimeType
    }];
    gltfJson.samplers = [{
      magFilter: 9729,   // LINEAR
      minFilter: 9987,   // LINEAR_MIPMAP_LINEAR
      wrapS: 10497,      // REPEAT
      wrapT: 10497       // REPEAT
    }];
  }

  const jsonStr = JSON.stringify(gltfJson);
  let jsonBuffer = Buffer.from(jsonStr, 'utf8');
  while (jsonBuffer.length % 4 !== 0) {
    jsonBuffer = Buffer.concat([jsonBuffer, Buffer.from(' ')]);
  }

  // Assemble binary data
  const binData = Buffer.alloc(totalBinSize);
  indexBuffer.copy(binData, bufferViews[0].byteOffset);
  posBuffer.copy(binData, bufferViews[1].byteOffset);

  let bvIdx = 2;
  if (normalBuffer) {
    normalBuffer.copy(binData, bufferViews[bvIdx].byteOffset);
    bvIdx++;
  }
  if (uvBuffer) {
    uvBuffer.copy(binData, bufferViews[bvIdx].byteOffset);
    bvIdx++;
  }
  if (texture) {
    texture.buffer.copy(binData, bufferViews[bvIdx].byteOffset);
  }

  // GLB header
  const headerSize = 12;
  const jsonChunkHeader = 8;
  const binChunkHeader = 8;
  const totalSize = headerSize + jsonChunkHeader + jsonBuffer.length + binChunkHeader + binData.length;

  const glb = Buffer.alloc(totalSize);
  let offset = 0;

  glb.writeUInt32LE(0x46546C67, offset); offset += 4;
  glb.writeUInt32LE(2, offset); offset += 4;
  glb.writeUInt32LE(totalSize, offset); offset += 4;

  glb.writeUInt32LE(jsonBuffer.length, offset); offset += 4;
  glb.writeUInt32LE(0x4E4F534A, offset); offset += 4;
  jsonBuffer.copy(glb, offset); offset += jsonBuffer.length;

  glb.writeUInt32LE(binData.length, offset); offset += 4;
  glb.writeUInt32LE(0x004E4942, offset); offset += 4;
  binData.copy(glb, offset);

  // Ensure output directory exists
  const outDir = path.dirname(OUTPUT_GLB);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_GLB, glb);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const sizeMB = (glb.length / (1024 * 1024)).toFixed(1);
  console.log(`  GLB written: ${OUTPUT_GLB}`);
  console.log(`  File size: ${sizeMB} MB`);
  console.log(`  Done in ${elapsed}s`);
  console.log('');
}

function align4(n) {
  return (n + 3) & ~3;
}

// ─── MAIN ───
async function main() {
  const totalStart = Date.now();

  const objData = await parseOBJ();
  const geometry = buildGeometry(objData);
  const texture = readTexture();
  writeGLB(geometry, texture);

  const totalElapsed = ((Date.now() - totalStart) / 1000).toFixed(1);
  console.log('════════════════════════════════════════════════');
  console.log(`✓ Conversion complete in ${totalElapsed}s`);
  console.log(`  Input:     ${(fs.statSync(INPUT_OBJ).size / (1024 * 1024)).toFixed(1)} MB OBJ`);
  console.log(`  Texture:   ${fs.existsSync(INPUT_TEXTURE) ? (fs.statSync(INPUT_TEXTURE).size / (1024 * 1024)).toFixed(1) + ' MB' : 'None'}`);
  console.log(`  Output:    ${(fs.statSync(OUTPUT_GLB).size / (1024 * 1024)).toFixed(1)} MB GLB`);
  console.log(`  Triangles: ${geometry.triangleCount.toLocaleString()}`);
  console.log('════════════════════════════════════════════════');
}

main().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
