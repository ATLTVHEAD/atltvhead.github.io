import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const IDS = [...'abcdefgh'].map((letter) => `building-${letter}`)
  .concat(['shipping-container-a', 'water-tower', 'chimney-basic', 'detail-tank']);
const digest = (data) => createHash('sha256').update(data).digest('hex');

function parseGlb(buffer, id) {
  if (buffer.length < 20 || buffer.toString('ascii', 0, 4) !== 'glTF'
      || buffer.readUInt32LE(4) !== 2 || buffer.readUInt32LE(8) !== buffer.length
      || buffer.toString('ascii', 16, 20) !== 'JSON') throw new Error(`Invalid GLB: ${id}`);
  const length = buffer.readUInt32LE(12);
  if (20 + length > buffer.length) throw new Error(`Invalid GLB JSON: ${id}`);
  return JSON.parse(buffer.subarray(20, 20 + length).toString('utf8'));
}

function safeDependency(uri) {
  if (typeof uri !== 'string' || !/^Textures\/[a-zA-Z0-9_.-]+$/.test(uri)
      || uri.includes('..') || isAbsolute(uri)) throw new Error(`Unsafe asset dependency: ${uri}`);
  return uri;
}

export async function importGameAssets({ source, output = 'assets/game/kenney-industrial', check = false } = {}) {
  if (!source) throw new Error('A source pack directory is required.');
  const input = join(source, 'Models', 'GLB format');
  const dependencies = new Map();
  const assets = [];
  const files = new Map();
  for (const id of IDS) {
    const name = `${id}.glb`;
    const bytes = await readFile(join(input, name));
    const gltf = parseGlb(bytes, id);
    const refs = (gltf.images ?? []).filter((image) => image.uri).map((image) => safeDependency(image.uri));
    for (const dependency of refs) {
      if (!dependencies.has(dependency)) dependencies.set(dependency, await readFile(join(input, dependency)));
    }
    const positions = (gltf.meshes ?? []).flatMap((mesh) => mesh.primitives ?? [])
      .map((primitive) => gltf.accessors?.[primitive.attributes?.POSITION])
      .filter((accessor) => accessor?.min?.length === 3 && accessor?.max?.length === 3);
    if (!positions.length) throw new Error(`Missing position bounds: ${id}`);
    const bounds = { min: [0, 1, 2].map((axis) => Math.min(...positions.map((p) => p.min[axis]))),
      max: [0, 1, 2].map((axis) => Math.max(...positions.map((p) => p.max[axis]))) };
    files.set(name, bytes);
    assets.push({ id, url: `assets/game/kenney-industrial/${name}`, sha256: digest(bytes),
      dependencies: refs, bounds, author: 'Kenney', license: 'CC0', role: id.startsWith('building-') ? 'building' : 'prop' });
  }
  files.set('License.txt', await readFile(join(source, 'License.txt')));
  for (const [name, bytes] of dependencies) files.set(name, bytes);
  const manifest = { version: 1, assets,
    dependencies: Object.fromEntries([...dependencies].map(([name, bytes]) => [name, digest(bytes)])) };
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
  files.set('manifest.json', manifestBytes);
  for (const [name, bytes] of files) {
    const destination = join(output, name);
    if (check) {
      const actual = await readFile(destination).catch(() => null);
      if (!actual || digest(actual) !== digest(bytes)) throw new Error(`Asset mismatch: ${name}`);
    } else {
      await mkdir(dirname(destination), { recursive: true });
      await writeFile(destination, bytes);
    }
  }
  if (resolve(output) === resolve('assets/game/kenney-industrial')) {
    const destination = resolve('assets/game/manifest.json');
    if (check) {
      const actual = await readFile(destination).catch(() => null);
      if (!actual || digest(actual) !== digest(manifestBytes)) throw new Error('Asset mismatch: assets/game/manifest.json');
    } else {
      await writeFile(destination, manifestBytes);
    }
  }
  return manifest;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const value = (flag) => args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined;
  importGameAssets({ source: value('--source'), output: value('--output'), check: args.includes('--check') })
    .then((manifest) => console.log(`${manifest.assets.length} local assets ${args.includes('--check') ? 'verified' : 'imported'}.`))
    .catch((error) => { console.error(error.message); process.exitCode = 1; });
}
