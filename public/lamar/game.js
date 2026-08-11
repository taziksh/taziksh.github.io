const WIDTH = 640;
const HEIGHT = 500;
const CORE_PLAYING = 1;
const CORE_PAUSED = 2;
const CORE_DEAD = 3;

const canvas = document.querySelector('#lamar-canvas');
const context = canvas.getContext('2d', { alpha: false });
const status = document.querySelector('#game-status');
const healthValue = document.querySelector('#health-value');
const boostValue = document.querySelector('#boost-value');
const killsValue = document.querySelector('#kills-value');
const difficultyValue = document.querySelector('#difficulty-value');
const audioToggle = document.querySelector('#audio-toggle');
const touchControls = document.querySelector('#touch-controls');

const assetNames = [
  'background.jpg',
  'titleBanner.png',
  'playButton.png',
  'quitButton.png',
  'diffEasy.png',
  'diffMeh.png',
  'diffHard.png',
  'nightSky.jpg',
  'spaceLamar.png',
  'goonOne.png',
  'lamProjectile.png',
  'goonProjectile.png',
  'lamarDed.png',
  // Retained from the original repository even though Game.java never drew it.
  'deathScreen.png',
];

let core;
let assets;
let screen = 'loading';
let lastFrameTime = performance.now();
let selectedDifficulty = 1;
let previousCoreState = CORE_PLAYING;
let audioEnabled = true;
let audioStarted = false;
let pausedInputPending = false;

const music = new Audio('/lamar/assets/lamarBackgroundMusic.wav');
music.loop = true;
music.preload = 'none';
music.volume = 0.55;

function loadImage(name) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.addEventListener('load', () => resolve([name, image]), { once: true });
    image.addEventListener('error', () => reject(new Error(`Could not load ${name}`)), {
      once: true,
    });
    image.src = `/lamar/assets/${name}`;
  });
}

async function instantiateCore() {
  const response = await fetch('/lamar/lamar_core.wasm');
  if (!response.ok) throw new Error(`WebAssembly request failed (${response.status})`);

  try {
    return (await WebAssembly.instantiateStreaming(response.clone(), {})).instance.exports;
  } catch {
    const bytes = await response.arrayBuffer();
    return (await WebAssembly.instantiate(bytes, {})).instance.exports;
  }
}

async function initialize() {
  try {
    const [wasm, imageEntries] = await Promise.all([
      instantiateCore(),
      Promise.all(assetNames.map(loadImage)),
    ]);
    core = wasm;
    assets = Object.fromEntries(imageEntries);
    if (core.lamar_version() !== 2) {
      throw new Error('The faithful Lamar WebAssembly core is out of date');
    }
    screen = 'title';
    status.textContent = 'Press any key, or choose PLAY.';
    canvas.focus();
  } catch (error) {
    screen = 'error';
    status.textContent = error instanceof Error ? error.message : String(error);
  }
}

async function ensureMusic() {
  if (!audioEnabled || audioStarted) return;
  try {
    await music.play();
    audioStarted = true;
    audioToggle.textContent = 'sound: on';
    audioToggle.setAttribute('aria-pressed', 'true');
    audioToggle.removeAttribute('title');
  } catch {
    audioStarted = false;
    audioToggle.textContent = 'sound: tap to start';
    audioToggle.title = 'Browser audio needs one more click to begin';
  }
}

function toggleMusic() {
  if (audioEnabled && !audioStarted) {
    ensureMusic();
    return;
  }

  audioEnabled = !audioEnabled;
  if (audioEnabled) ensureMusic();
  else {
    music.pause();
    audioStarted = false;
  }
  audioToggle.textContent = `sound: ${audioEnabled ? 'on' : 'off'}`;
  audioToggle.setAttribute('aria-pressed', String(audioEnabled));
  audioToggle.removeAttribute('title');
}

function showDifficulty() {
  screen = 'difficulty';
  status.textContent = 'Choose Easy (E), Meh (M), or Hard (H).';
  ensureMusic();
}

function confirmDifficulty(difficulty) {
  selectedDifficulty = difficulty;
  screen = 'post-difficulty';
  const name = ['Easy', 'Meh', 'Hard'][difficulty - 1];
  status.textContent = `${name} selected. Press I for info, Q to quit, or any other key to launch.`;
  ensureMusic();
}

function showInfo() {
  screen = 'info';
  status.textContent = 'Press any key to close the original info screen and launch.';
}

function startGame() {
  const seed = (Date.now() ^ Math.floor(performance.now() * 1000)) >>> 0;
  core.lamar_reset(selectedDifficulty, seed);
  previousCoreState = CORE_PLAYING;
  pausedInputPending = false;
  screen = 'playing';
  status.textContent = 'Legacy controls: W/S move 15 px, Space fires, P pauses.';
  touchControls.hidden = false;
  ensureMusic();
  canvas.focus();
}

function quitGame() {
  screen = 'quit';
  music.pause();
  audioStarted = false;
  touchControls.hidden = true;
  status.textContent = 'Lamar has returned to space. Press Enter to play again.';
}

function returnToTitle() {
  screen = 'title';
  touchControls.hidden = true;
  status.textContent = 'Press any key, or choose PLAY.';
}

function isCharacterInput(event) {
  return event.key.length === 1 || ['Enter', 'ArrowUp', 'ArrowDown'].includes(event.code);
}

function chooseDifficultyFromKey(code) {
  if (code === 'KeyE') confirmDifficulty(1);
  else if (code === 'KeyM') confirmDifficulty(2);
  else if (code === 'KeyH') confirmDifficulty(3);
  else return false;
  return true;
}

function processLegacyGameplayKey(event) {
  if (core.lamar_state() === CORE_DEAD) {
    if (event.code === 'KeyR') {
      core.lamar_restart();
      previousCoreState = CORE_PLAYING;
      status.textContent = 'Legacy retry: health is 200; kills and enemy state are retained.';
    } else if (event.code === 'KeyQ') quitGame();
    if (isCharacterInput(event)) event.preventDefault();
    return;
  }

  if (!isCharacterInput(event)) return;

  // Game.java resumed on any queued character, then processed that same
  // character. Pressing P to resume therefore immediately pauses again.
  if (core.lamar_state() === CORE_PAUSED) {
    core.lamar_toggle_pause();
    if (pausedInputPending) {
      core.lamar_register_input();
      pausedInputPending = false;
    }
  }

  if (event.code === 'KeyW' || event.code === 'ArrowUp') {
    core.lamar_nudge_player(-1);
  } else if (event.code === 'KeyS' || event.code === 'ArrowDown') {
    core.lamar_nudge_player(1);
  } else if (event.code === 'Space') {
    core.lamar_fire();
  } else if (event.code === 'KeyP') {
    core.lamar_toggle_pause();
    pausedInputPending = true;
  }

  if (core.lamar_state() === CORE_PLAYING) core.lamar_register_input();
  const state = core.lamar_state();
  status.textContent =
    state === CORE_PAUSED
      ? 'GAME PAUSED — press any non-P key to continue.'
      : 'Legacy controls: W/S move 15 px, Space fires, P pauses.';
  event.preventDefault();
}

function onKeyDown(event) {
  if (screen === 'loading' || screen === 'error') return;

  if (screen === 'title') {
    if (isCharacterInput(event)) {
      showDifficulty();
      event.preventDefault();
    }
    return;
  }

  if (screen === 'difficulty') {
    if (chooseDifficultyFromKey(event.code)) event.preventDefault();
    return;
  }

  if (screen === 'post-difficulty') {
    if (!isCharacterInput(event)) return;
    if (event.code === 'KeyI') showInfo();
    else if (event.code === 'KeyQ') quitGame();
    else startGame();
    event.preventDefault();
    return;
  }

  if (screen === 'info') {
    if (isCharacterInput(event)) {
      startGame();
      event.preventDefault();
    }
    return;
  }

  if (screen === 'quit') {
    if (event.code === 'Enter' || event.code === 'Space') returnToTitle();
    return;
  }

  if (screen === 'playing') processLegacyGameplayKey(event);
}

function canvasPoint(event) {
  const bounds = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - bounds.left) / bounds.width) * WIDTH,
    y: ((event.clientY - bounds.top) / bounds.height) * HEIGHT,
  };
}

function onCanvasClick(event) {
  canvas.focus();
  const point = canvasPoint(event);

  if (screen === 'title') {
    if (point.y >= 230 && point.y <= 350 && point.x < WIDTH / 2) showDifficulty();
    else if (point.y >= 230 && point.y <= 350) quitGame();
  } else if (screen === 'difficulty') {
    if (point.x < 225) confirmDifficulty(1);
    else if (point.x < 425) confirmDifficulty(2);
    else confirmDifficulty(3);
  } else if (screen === 'post-difficulty' || screen === 'info') {
    startGame();
  } else if (screen === 'quit') {
    returnToTitle();
  } else if (screen === 'playing' && core.lamar_state() === CORE_DEAD) {
    if (point.x < WIDTH / 2) {
      core.lamar_restart();
      previousCoreState = CORE_PLAYING;
      status.textContent = 'Legacy retry: health is 200; kills and enemy state are retained.';
    } else quitGame();
  }
}

function drawTitle() {
  context.drawImage(assets['background.jpg'], 0, 0, 700, 700);
  context.drawImage(assets['titleBanner.png'], 200, 0);
  context.drawImage(assets['playButton.png'], 93, 250, 213, 80);
  context.drawImage(assets['quitButton.png'], 363, 250, 213, 80);
}

function drawDifficulty() {
  context.drawImage(assets['background.jpg'], 0, 0, 700, 700);
  context.drawImage(assets['titleBanner.png'], 200, 0);
  context.drawImage(assets['diffEasy.png'], 60, 300, 160, 53);
  context.drawImage(assets['diffMeh.png'], 250, 360, 160, 53);
  context.drawImage(assets['diffHard.png'], 440, 300, 160, 53);
}

function drawInfo() {
  drawDifficulty();
  context.fillStyle = 'rgba(0, 0, 0, 0.72)';
  context.fillRect(145, 45, 350, 405);
  context.fillStyle = '#fff';
  context.font = 'bold 18px Arial, sans-serif';
  context.fillText("LAMAR'S SPACE ADVENTURES", 180, 100);
  context.font = '17px Arial, sans-serif';
  context.fillText('Use W to move up', 200, 165);
  context.fillText('Use S to move down', 200, 215);
  context.fillText('Use Spacebar to fire', 200, 265);
  context.fillText('Use P to pause game', 200, 315);
  context.font = '14px Arial, sans-serif';
  context.fillText('press any key to continue', 225, 395);
}

function drawLaserTrail() {
  if (!core.lamar_laser_visible()) return;
  for (let x = 227; x <= core.lamar_laser_end_x(); x += 8) {
    context.drawImage(assets['lamProjectile.png'], x, core.lamar_laser_y(), 60, 10);
  }
}

function drawGame() {
  // Game.java drew the 1280×720 image at native size into a 640×500 buffer,
  // so the browser must crop it rather than scale it to fit.
  context.drawImage(assets['nightSky.jpg'], 0, 0);
  context.drawImage(assets['spaceLamar.png'], -45, core.lamar_player_y(), 350, 350);

  context.fillStyle = '#00d929';
  context.fillRect(0, 0, Math.max(0, core.lamar_health()), 10);
  context.fillStyle = '#193cff';
  context.fillRect(0, 10, core.lamar_boost(), 10);

  drawLaserTrail();

  if (core.lamar_enemy_bullet_active()) {
    context.drawImage(
      assets['goonProjectile.png'],
      core.lamar_enemy_bullet_x(),
      core.lamar_enemy_bullet_y(),
      50,
      10,
    );
  }

  context.drawImage(
    assets['goonOne.png'],
    core.lamar_enemy_x(),
    core.lamar_enemy_y(),
    200,
    160,
  );

  if (core.lamar_state() === CORE_PAUSED) {
    context.fillStyle = '#134de8';
    context.font = 'bold 20px Arial Black, Arial, sans-serif';
    context.fillText('GAME PAUSED - PRESS ANY KEY TO CONTINUE', 65, 35);
  }

  if (core.lamar_state() === CORE_DEAD) drawDeath();
}

function drawDeath() {
  context.drawImage(assets['lamarDed.png'], 0, 0, WIDTH, 400);
  context.fillStyle = '#1737e8';
  context.font = 'bold 30px Arial Black, Arial, sans-serif';
  context.fillText(`Total kills: ${core.lamar_kills()}`, 100, 50);
  context.fillStyle = '#111';
  context.font = 'bold 20px Arial Black, Arial, sans-serif';
  context.fillText('R / tap left: retry', 80, 455);
  context.fillText('Q / tap right: quit', 365, 455);
}

function drawQuit() {
  context.fillStyle = '#05050a';
  context.fillRect(0, 0, WIDTH, HEIGHT);
  context.drawImage(assets['spaceLamar.png'], 155, 35, 330, 330);
  context.fillStyle = '#ec8b25';
  context.font = 'bold 24px Arial Black, Arial, sans-serif';
  context.textAlign = 'center';
  context.fillText('LAMAR WILL RETURN', WIDTH / 2, 415);
  context.font = '16px Arial, sans-serif';
  context.fillStyle = '#fff';
  context.fillText('press Enter or tap to play again', WIDTH / 2, 452);
  context.textAlign = 'start';
}

function drawMessage(message) {
  context.fillStyle = '#05050a';
  context.fillRect(0, 0, WIDTH, HEIGHT);
  context.fillStyle = '#fff';
  context.font = '20px system-ui, sans-serif';
  context.textAlign = 'center';
  context.fillText(message, WIDTH / 2, HEIGHT / 2);
  context.textAlign = 'start';
}

function updateHud() {
  if (!core || screen !== 'playing') {
    healthValue.textContent = '—';
    boostValue.textContent = '—';
    killsValue.textContent = '—';
    difficultyValue.textContent = '—';
    return;
  }
  healthValue.textContent = `${core.lamar_health()}/${core.lamar_max_health()}`;
  boostValue.textContent = `${core.lamar_boost()}/25`;
  killsValue.textContent = String(core.lamar_kills());
  difficultyValue.textContent = ['Easy', 'Meh', 'Hard'][selectedDifficulty - 1];
}

function frame(now) {
  const dt = Math.min((now - lastFrameTime) / 1000, 0.25);
  lastFrameTime = now;

  if (screen === 'playing' && core.lamar_state() === CORE_PLAYING) {
    core.lamar_update(dt);
  }

  if (screen === 'playing') {
    const currentCoreState = core.lamar_state();
    if (currentCoreState !== previousCoreState && currentCoreState === CORE_DEAD) {
      status.textContent =
        'Lamar crashed. Press R or tap left to retry; Q or tap right to quit.';
    }
    previousCoreState = currentCoreState;
  }

  context.imageSmoothingEnabled = true;
  if (screen === 'loading') drawMessage('Loading Lamar…');
  else if (screen === 'error') drawMessage('Lamar could not launch');
  else if (screen === 'title') drawTitle();
  else if (screen === 'difficulty' || screen === 'post-difficulty') drawDifficulty();
  else if (screen === 'info') drawInfo();
  else if (screen === 'playing') drawGame();
  else if (screen === 'quit') drawQuit();
  updateHud();

  if (screen === 'playing' && core.lamar_laser_visible()) core.lamar_after_render();
  requestAnimationFrame(frame);
}

function triggerTouchAction(action) {
  if (screen !== 'playing' || core.lamar_state() === CORE_DEAD) return;
  if (core.lamar_state() === CORE_PAUSED) {
    core.lamar_toggle_pause();
    if (pausedInputPending) {
      core.lamar_register_input();
      pausedInputPending = false;
    }
  }

  if (action === 'up') core.lamar_nudge_player(-1);
  else if (action === 'down') core.lamar_nudge_player(1);
  else if (action === 'fire') core.lamar_fire();
  else if (action === 'pause') {
    core.lamar_toggle_pause();
    pausedInputPending = true;
  }

  if (core.lamar_state() === CORE_PLAYING) core.lamar_register_input();
  status.textContent =
    core.lamar_state() === CORE_PAUSED
      ? 'GAME PAUSED — press any non-P key to continue.'
      : 'Legacy controls: W/S move 15 px, Space fires, P pauses.';
}

audioToggle.addEventListener('click', toggleMusic);
canvas.addEventListener('click', onCanvasClick);
window.addEventListener('keydown', onKeyDown, { passive: false });
document.querySelectorAll('[data-action]').forEach((button) => {
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    triggerTouchAction(button.dataset.action);
  });
});

requestAnimationFrame(frame);
initialize();
