let loadGeneration = 0;

function resourcesOf(scene) {
  const result = new Set();
  scene?.traverse?.((object) => {
    if (object.geometry) result.add(object.geometry);
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!material) continue;
      result.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) result.add(value);
    }
  });
  return result;
}

function abortError() {
  return new DOMException('Asset loading cancelled.', 'AbortError');
}

async function verifyHash(bytes, expected, id) {
  if (!/^[a-f0-9]{64}$/.test(expected)) throw new Error(`Invalid asset hash: ${id}`);
  if (!globalThis.crypto?.subtle) throw new Error(`Cannot verify asset hash: ${id}`);
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
    .map((value) => value.toString(16).padStart(2, '0')).join('');
  if (hash !== expected) throw new Error(`Asset hash mismatch: ${id}`);
}

export async function loadGameAssets({ THREE, manifest, signal, onProgress = () => {} }) {
  if (!THREE?.GLTFLoader || !Array.isArray(manifest?.assets)) throw new TypeError('A loader and asset manifest are required.');
  const templates = new Map();
  const counts = new Map();
  const retained = new Map();
  let disposed = false;
  const add = (resources) => resources.forEach((resource) => counts.set(resource, (counts.get(resource) ?? 0) + 1));
  const drop = (resources) => resources.forEach((resource) => {
    const count = counts.get(resource);
    if (count === 1) { counts.delete(resource); resource.dispose?.(); }
    else if (count > 1) counts.set(resource, count - 1);
  });
  const loader = new THREE.GLTFLoader();
  const generation = ++loadGeneration;
  try {
    for (const dependency of Object.keys(manifest.dependencies ?? {})) {
      if (!/^Textures\/[a-zA-Z0-9_.-]+$/.test(dependency) || dependency.includes('..')) {
        throw new Error(`Invalid asset dependency: ${dependency}`);
      }
      const response = await fetch(`assets/game/kenney-industrial/${dependency}`, { signal });
      if (!response.ok) throw new Error(`Failed to load asset dependency ${dependency}: ${response.status}`);
      const bytes = await response.arrayBuffer();
      await verifyHash(bytes, manifest.dependencies[dependency], dependency);
    }
    for (const [index, asset] of manifest.assets.entries()) {
      if (!asset?.id || templates.has(asset.id) || typeof asset.url !== 'string'
          || !/^assets\/game\/[a-zA-Z0-9_./-]+$/.test(asset.url) || asset.url.includes('..')) {
        throw new Error(`Invalid local asset: ${asset?.id ?? 'unknown'}`);
      }
      if (signal?.aborted) throw abortError();
      let data = null;
      if (asset.sha256) {
        const response = await fetch(`${asset.url}?load=${generation}`, { signal });
        if (!response.ok) throw new Error(`Failed to load ${asset.id}: ${response.status}`);
        data = await response.arrayBuffer();
        await verifyHash(data, asset.sha256, asset.id);
        if (signal?.aborted) throw abortError();
      }
      const gltf = await new Promise((resolve, reject) => {
        let settled = false;
        function abort() { if (!settled) { settled = true; reject(abortError()); } }
        signal?.addEventListener('abort', abort, { once: true });
        const onLoad = (result) => {
          signal?.removeEventListener('abort', abort);
          if (settled || signal?.aborted) {
            const late = resourcesOf(result.scene);
            add(late); drop(late);
            return;
          }
          settled = true;
          resolve(result);
        };
        const onError = (error) => {
          signal?.removeEventListener('abort', abort);
          if (!settled) { settled = true; reject(new Error(`Failed to load ${asset.id}: ${error?.message ?? error}`)); }
        };
        if (data) loader.parse(data, asset.url.slice(0, asset.url.lastIndexOf('/') + 1), onLoad, onError);
        else loader.load(`${asset.url}?load=${generation}`, onLoad, undefined, onError);
      });
      const resources = resourcesOf(gltf.scene);
      add(resources);
      templates.set(asset.id, { gltf, resources });
      onProgress({ loaded: index + 1, total: manifest.assets.length, id: asset.id });
    }
  } catch (error) {
    templates.forEach(({ resources }) => drop(resources));
    throw error;
  }
  return {
    get(id) { return templates.get(id)?.gltf ?? null; },
    retain(id) {
      if (disposed) throw new Error('Asset library is disposed.');
      const template = templates.get(id);
      if (!template) throw new Error(`Unknown asset: ${id}`);
      const scene = template.gltf.scene.clone(true);
      add(template.resources);
      retained.set(scene, template.resources);
      return scene;
    },
    release(scene) {
      const resources = retained.get(scene);
      if (resources) { retained.delete(scene); drop(resources); }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      templates.forEach(({ resources }) => drop(resources));
      templates.clear();
    },
  };
}
