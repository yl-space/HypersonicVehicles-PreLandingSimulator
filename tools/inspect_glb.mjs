#!/usr/bin/env node
/**
 * Quick GLB inspector — dumps the JSON header of a binary glTF.
 * Usage: node tools/inspect_glb.mjs <path.glb>
 */
import { readFileSync } from 'node:fs';

const path = process.argv[2];
if (!path) { console.error('Usage: node inspect_glb.mjs <path.glb>'); process.exit(1); }

const buf = readFileSync(path);

// GLB header: 12 bytes (magic, version, length)
const magic = buf.toString('ascii', 0, 4);
if (magic !== 'glTF') { console.error('Not a GLB:', magic); process.exit(1); }

const version = buf.readUInt32LE(4);
const length  = buf.readUInt32LE(8);

// First chunk: JSON
const chunk0Len  = buf.readUInt32LE(12);
const chunk0Type = buf.toString('ascii', 16, 20);   // 'JSON'
const json = JSON.parse(buf.toString('utf8', 20, 20 + chunk0Len));

console.log(`GLB v${version}, length ${length} bytes`);
console.log(`Asset:`, json.asset);
console.log(`\nScenes (${json.scenes?.length}):`, json.scenes);
console.log(`\nNodes (${json.nodes?.length}):`);
json.nodes?.forEach((n, i) => {
    const t = n.translation ? ` t=[${n.translation.map(x=>x.toFixed(3))}]` : '';
    const r = n.rotation    ? ` r=[${n.rotation.map(x=>x.toFixed(3))}]` : '';
    const s = n.scale       ? ` s=[${n.scale.map(x=>x.toFixed(3))}]` : '';
    const c = n.children    ? ` children=[${n.children.join(',')}]` : '';
    const m = n.mesh != null ? ` mesh=${n.mesh}` : '';
    console.log(`  [${i}] ${n.name || '<no-name>'}${t}${r}${s}${c}${m}`);
});

console.log(`\nMeshes (${json.meshes?.length}):`);
json.meshes?.forEach((m, i) => {
    const prims = m.primitives?.length ?? 0;
    const matIdx = m.primitives?.map(p => p.material).filter(x => x != null);
    console.log(`  [${i}] ${m.name || '<no-name>'}  primitives=${prims}  materials=[${matIdx?.join(',')}]`);
});

console.log(`\nMaterials (${json.materials?.length}):`);
json.materials?.forEach((m, i) => {
    const pbr = m.pbrMetallicRoughness || {};
    const base = pbr.baseColorFactor ? `rgba(${pbr.baseColorFactor.map(x=>x.toFixed(2)).join(',')})` : '?';
    const tex  = pbr.baseColorTexture ? `tex#${pbr.baseColorTexture.index}` : '';
    console.log(`  [${i}] ${m.name || '<no-name>'}  base=${base} ${tex}  metal=${pbr.metallicFactor ?? '?'}  rough=${pbr.roughnessFactor ?? '?'}`);
});

console.log(`\nTextures (${json.textures?.length || 0}):`, json.textures);
console.log(`\nImages (${json.images?.length || 0}):`, json.images?.map(i => ({ name: i.name, mimeType: i.mimeType, bufferView: i.bufferView })));

// Bounding boxes from accessors (look at POSITION accessors)
console.log(`\nPosition accessors (for bounds):`);
const posAccessors = new Set();
json.meshes?.forEach((m, mi) => {
    m.primitives?.forEach((p, pi) => {
        if (p.attributes?.POSITION != null) posAccessors.add(p.attributes.POSITION);
    });
});
let globalMin = [Infinity, Infinity, Infinity], globalMax = [-Infinity, -Infinity, -Infinity];
for (const idx of posAccessors) {
    const a = json.accessors[idx];
    if (a?.min && a?.max) {
        for (let i = 0; i < 3; i++) {
            globalMin[i] = Math.min(globalMin[i], a.min[i]);
            globalMax[i] = Math.max(globalMax[i], a.max[i]);
        }
        console.log(`  accessor[${idx}]: min=[${a.min.map(x=>x.toFixed(2))}] max=[${a.max.map(x=>x.toFixed(2))}]`);
    }
}
console.log(`\nGlobal AABB:`);
console.log(`  min: [${globalMin.map(x=>x.toFixed(2))}]`);
console.log(`  max: [${globalMax.map(x=>x.toFixed(2))}]`);
console.log(`  size: [${globalMin.map((mn,i)=>(globalMax[i]-mn).toFixed(2))}]`);
