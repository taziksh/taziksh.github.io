const WIDTH = 640;
const HEIGHT = 500;
const CORE_PLAYING = 1;
const CORE_PAUSED = 2;
const CORE_DEAD = 3;

const canvas = document.querySelector('#lamar-canvas');
const context = canvas.getContext('2d', { alpha: false });
const status = document.querySelector('#game-status');
const infoWindow = document.querySelector('#info-window');

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
let audioStarted = false;
let pausedInputPending = false;

const music = new Audio('/lamar/assets/lamarBackgroundMusic.wav');
music.loop = true;
music.preload = 'none';
music.volume = 1;

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
    status.textContent = 'Press any key.';
    ensureMusic();
    canvas.focus();
  } catch (error) {
    screen = 'error';
    status.textContent = error instanceof Error ? error.message : String(error);
  }
}

async function ensureMusic() {
  if (audioStarted) return;
  try {
    await music.play();
    audioStarted = true;
  } catch {
    audioStarted = false;
  }
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
  infoWindow.hidden = false;
  status.textContent = 'Info window opened. Press any key to continue.';
}

function startGame() {
  const seed = (Date.now() ^ Math.floor(performance.now() * 1000)) >>> 0;
  core.lamar_reset(selectedDifficulty, seed);
  previousCoreState = CORE_PLAYING;
  pausedInputPending = false;
  screen = 'playing';
  status.textContent = 'Use W and S to move, Spacebar to fire, and P to pause.';
  ensureMusic();
  canvas.focus();
}

function quitGame() {
  screen = 'quit';
  music.pause();
  audioStarted = false;
  infoWindow.hidden = true;
  status.textContent = 'Game closed.';
}

function isCharacterInput(event) {
  return event.key.length === 1 || event.key === 'Enter';
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
    if (event.key === 'r') {
      core.lamar_restart();
      previousCoreState = CORE_PLAYING;
    } else if (event.key === 'q') quitGame();
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

  if (event.key === 'w' || event.key === 'W') {
    core.lamar_nudge_player(-1);
  } else if (event.key === 's' || event.key === 'S') {
    core.lamar_nudge_player(1);
  } else if (event.code === 'Space') {
    core.lamar_fire();
  } else if (event.key === 'p' || event.key === 'P') {
    core.lamar_toggle_pause();
    pausedInputPending = true;
  }

  if (core.lamar_state() === CORE_PLAYING) core.lamar_register_input();
  const state = core.lamar_state();
  status.textContent =
    state === CORE_PAUSED
      ? 'GAME PAUSED — press any non-P key to continue.'
      : 'Use W and S to move, Spacebar to fire, and P to pause.';
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
    if (event.key === 'i') showInfo();
    else if (event.key === 'q') quitGame();
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

  if (screen === 'quit') return;

  if (screen === 'playing') processLegacyGameplayKey(event);
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
}

function drawQuit() {
  context.fillStyle = '#000';
  context.fillRect(0, 0, WIDTH, HEIGHT);
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
      status.textContent = 'Lamar crashed. Press lowercase R to retry or lowercase Q to quit.';
    }
    previousCoreState = currentCoreState;
  }

  context.imageSmoothingEnabled = true;
  if (screen === 'loading' || screen === 'error') drawQuit();
  else if (screen === 'title') drawTitle();
  else if (screen === 'difficulty' || screen === 'post-difficulty') drawDifficulty();
  else if (screen === 'info') drawDifficulty();
  else if (screen === 'playing') drawGame();
  else if (screen === 'quit') drawQuit();

  if (screen === 'playing' && core.lamar_laser_visible()) core.lamar_after_render();
  requestAnimationFrame(frame);
}
canvas.addEventListener('pointerdown', () => canvas.focus());
window.addEventListener('keydown', onKeyDown, { passive: false });

requestAnimationFrame(frame);
initialize();
