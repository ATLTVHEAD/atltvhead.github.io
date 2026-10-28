import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { importGameAssets } from '../../scripts/import-game-assets.js';
import { loadGameAssets } from '../../js/game/render/game-assets.js';

const folders = [];
afterEach(() => folders.splice(0).forEach((folder) => rmSync(folder, { recursive: true, force: true })));

function fixture(textureUri = 'Textures/colormap.png') {
  const root = mkdtempSync(join(tmpdir(), 'skate-assets-'));
  folders.push(root);
  const source = join(root, 'source');
  const output = join(root, 'output');
  const glb = join(source, 'Models', 'GLB format');
  mkdirSync(join(glb, 'Textures'), { recursive: true });
  writeFileSync(join(source, 'License.txt'), 'CC0');
  writeFileSync(join(glb, 'Textures', 'colormap.png'), 'texture');
  const json = Buffer.from(JSON.stringify({ images: [{ uri: textureUri }], meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    accessors: [{ min: [-1, 0, -1], max: [1, 2, 1] }] }));
  const padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 0x20);
  json.copy(padded);
  const header = Buffer.alloc(20);
  header.write('glTF'); header.writeUInt32LE(2, 4); header.writeUInt32LE(20 + padded.length, 8);
  header.writeUInt32LE(padded.length, 12); header.write('JSON', 16);
  const names = [...'abcdefgh'].map((c) => `building-${c}`).concat(['shipping-container-a', 'water-tower', 'chimney-basic', 'detail-tank']);
  for (const name of names) writeFileSync(join(glb, `${name}.glb`), Buffer.concat([header, padded]));
  return { source, output };
}

describe('game asset importer', () => {
  it('assets_allowlistCopiesAllTextureDependencies', async () => {
    const { source, output } = fixture();
    const manifest = await importGameAssets({ source, output });
    expect(manifest.assets).toHaveLength(12);
    expect(manifest.assets.every((asset) => asset.dependencies.includes('Textures/colormap.png'))).toBe(true);
    expect(readFileSync(join(output, 'Textures', 'colormap.png'), 'utf8')).toBe('texture');
    expect(await importGameAssets({ source, output, check: true })).toEqual(manifest);
  });
  it('assets_rejectsPathTraversalAndBadHash', async () => {
    const invalid = fixture('../outside.png');
    await expect(importGameAssets(invalid)).rejects.toThrow(/unsafe/i);
    const { source, output } = fixture();
    await importGameAssets({ source, output });
    writeFileSync(join(output, 'building-a.glb'), 'modified');
    await expect(importGameAssets({ source, output, check: true })).rejects.toThrow(/building-a/);
  });
});

describe('game asset loader', () => {
  it('assets_sharedModelSurvivesOneRelease', async () => {
    let disposed = 0;
    const geometry = { dispose() { disposed += 1; } };
    const material = { dispose() { disposed += 1; } };
    function scene() { return { traverse(fn) { fn({ geometry, material }); }, clone() { return scene(); } }; }
    class GLTFLoader { load(url, onLoad) { onLoad({ scene: scene(), animations: [] }); } }
    const assets = await loadGameAssets({ THREE: { GLTFLoader },
      manifest: { assets: [{ id: 'one', url: 'assets/game/one.glb' }] } });
    const first = assets.retain('one');
    const second = assets.retain('one');
    assets.release(first);
    expect(disposed).toBe(0);
    assets.dispose();
    expect(disposed).toBe(0);
    assets.release(second);
    expect(disposed).toBe(2);
  });
  it('assets_abortDisposesLateResults', async () => {
    let callback;
    let disposed = 0;
    class GLTFLoader { load(url, onLoad) { callback = onLoad; } }
    const controller = new AbortController();
    const pending = loadGameAssets({ THREE: { GLTFLoader }, signal: controller.signal,
      manifest: { assets: [{ id: 'one', url: 'assets/game/one.glb' }] } });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    callback({ scene: { traverse(fn) { fn({ geometry: { dispose() { disposed += 1; } } }); } } });
    expect(disposed).toBe(1);
  });
});
