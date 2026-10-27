export function startSkateGame({ root, THREE }) {
  if (!root) throw new Error('A game root element is required.');
  if (!THREE) throw new Error('The local Three.js library is required.');

  root.dataset.gameState = 'ready';
  let disposed = false;

  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      root.dataset.gameState = 'disposed';
    },
  };
}

const root = document.querySelector('#game-root');
if (root) {
  try {
    window.skateGame = startSkateGame({ root, THREE: window.THREE });
  } catch (error) {
    root.dataset.gameState = 'error';
    console.error(error);
  }
}
