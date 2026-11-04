// Readiness is published only after fonts, images and two layout frames settle.
export async function sceneReady() {
  const root = document.getElementById('root')!;
  await document.fonts.ready;
  await Promise.all(Array.from(root.querySelectorAll('img')).map(async image => {
    await image.decode();
  }));
  await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  root.dataset.screenshotReady = 'true';
}
export function prepareScene(allowed: readonly string[]) {
  const scene = new URLSearchParams(location.search).get('screenshot')!;
  if (!allowed.includes(scene)) {
    document.getElementById('root')!.textContent = `Unknown screenshot scene: ${scene}. Available: ${allowed.join(', ')}`;
    throw new Error(`Unknown screenshot scene: ${scene}`);
  }
  const style = document.createElement('style');
  style.textContent = `#root { min-height: 100dvh; } *, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }`;
  document.head.append(style);
  return scene;
}
