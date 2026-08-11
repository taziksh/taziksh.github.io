const WIDTH = 640;
const HEIGHT = 500;
const CORE_PLAYING = 1;
const CORE_PAUSED = 2;
const CORE_DEAD = 3;
const INPUT_UP = 1;
const INPUT_DOWN = 2;

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
let movementInput = 0;
let lastFrameTime = performance.now();
let selectedDifficulty = 1;
let audioEnabled = true;
let audioStarted = false;
let previousCoreState = CORE_PLAYING;

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
  if (!response.ok) {
    throw new Error(`WebAssembly request failed (${response.status})`);
  }

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
    if (core.lamar_version() !== 1) {
      throw new Error('Unsupported Lamar WebAssembly core');
    }
    screen = 'title';
    status.textContent = 'Ready. Press any key or choose PLAY.';
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
  if (audioEnabled) {
    ensureMusic();
  } else {
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

function startGame(difficulty) {
  selectedDifficulty = difficulty;
  const seed = (Date.now() ^ Math.floor(performance.now() * 1000)) >>> 0;
  core.lamar_reset(difficulty, seed);
  previousCoreState = CORE_PLAYING;
  movementInput = 0;
  core.lamar_set_input(0);
  screen = 'playing';
  status.textContent = 'Use W/S or ↑/↓ to move. Space fires. P pauses.';
  touchControls.hidden = false;
  ensureMusic();
  canvas.focus();
}

function quitGame() {
  screen = 'quit';
  movementInput = 0;
  if (core) core.lamar_set_input(0);
  music.pause();
  audioStarted = false;
  touchControls.hidden = true;
  status.textContent = 'Lamar has returned to space. Press Enter to play again.';
}

function returnToTitle() {
  screen = 'title';
  movementInput = 0;
  touchControls.hidden = true;
  status.textContent = 'Ready. Press any key or choose PLAY.';
}

function setMovement(bit, pressed) {
  movementInput = pressed ? movementInput | bit : movementInput & ~bit;
  if (core && screen === 'playing') core.lamar_set_input(movementInput);
}

function chooseDifficultyFromKey(code) {
  if (code === 'KeyE') startGame(1);
  if (code === 'KeyM') startGame(2);
  if (code === 'KeyH') startGame(3);
}

function onKeyDown(event) {
  if (screen === 'loading' || screen === 'error') return;

  if (screen === 'title') {
    if (event.code === 'KeyQ' || event.code === 'Escape') quitGame();
    else showDifficulty();
    event.preventDefault();
    return;
  }

  if (screen === 'difficulty') {
    chooseDifficultyFromKey(event.code);
    if (['KeyE', 'KeyM', 'KeyH'].includes(event.code)) event.preventDefault();
    return;
  }

  if (screen === 'quit') {
    if (event.code === 'Enter' || event.code === 'Space') returnToTitle();
    return;
  }

  if (screen !== 'playing') return;

  if (core.lamar_state() === CORE_DEAD) {
    if (event.code === 'KeyR') {
      core.lamar_restart();
      previousCoreState = CORE_PLAYING;
      status.textContent = 'Retry!';
    } else if (event.code === 'KeyQ' || event.code === 'Escape') {
      quitGame();
    }
    event.preventDefault();
    return;
  }

  if (event.code === 'KeyW' || event.code === 'ArrowUp') {
    if (!event.repeat) core.lamar_nudge_player(-1);
    setMovement(INPUT_UP, true);
    event.preventDefault();
  } else if (event.code === 'KeyS' || event.code === 'ArrowDown') {
    if (!event.repeat) core.lamar_nudge_player(1);
    setMovement(INPUT_DOWN, true);
    event.preventDefault();
  } else if (event.code === 'Space' && !event.repeat) {
    core.lamar_fire();
    event.preventDefault();
  } else if (event.code === 'KeyP' && !event.repeat) {
    core.lamar_toggle_pause();
    status.textContent =
      core.lamar_state() === CORE_PAUSED ? 'Game paused.' : 'Game resumed.';
    event.preventDefault();
  }
}

function onKeyUp(event) {
  if (event.code === 'KeyW' || event.code === 'ArrowUp') {
    setMovement(INPUT_UP, false);
    event.preventDefault();
  } else if (event.code === 'KeyS' || event.code === 'ArrowDown') {
    setMovement(INPUT_DOWN, false);
    event.preventDefault();
  }
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
    if (point.x < 225) startGame(1);
    else if (point.x < 425) startGame(2);
    else startGame(3);
  } else if (screen === 'quit') {
    returnToTitle();
  } else if (screen === 'playing' && core.lamar_state() === CORE_DEAD) {
    if (point.x < WIDTH / 2) {
      core.lamar_restart();
      previousCoreState = CORE_PLAYING;
      status.textContent = 'Retry!';
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

function drawGame() {
  context.drawImage(assets['nightSky.jpg'], 0, 0, WIDTH, HEIGHT);
  context.drawImage(assets['spaceLamar.png'], -45, core.lamar_player_y(), 350, 350);
  context.drawImage(
    assets['goonOne.png'],
    core.lamar_enemy_x(),
    core.lamar_enemy_y(),
    200,
    160,
  );

  for (let index = 0; index < 8; index += 1) {
    if (core.lamar_bullet_active(index)) {
      context.drawImage(
        assets['lamProjectile.png'],
        core.lamar_bullet_x(index),
        core.lamar_bullet_y(index),
        60,
        10,
      );
    }
  }

  if (core.lamar_enemy_bullet_active()) {
    context.drawImage(
      assets['goonProjectile.png'],
      core.lamar_enemy_bullet_x(),
      core.lamar_enemy_bullet_y(),
      50,
      10,
    );
  }

  context.fillStyle = '#00d929';
  context.fillRect(0, 0, Math.max(0, core.lamar_health()), 10);
  context.fillStyle = '#193cff';
  context.fillRect(0, 10, core.lamar_boost(), 10);

  if (core.lamar_state() === CORE_PAUSED) {
    context.fillStyle = 'rgba(0, 0, 0, 0.58)';
    context.fillRect(0, 0, WIDTH, HEIGHT);
    context.fillStyle = '#3973ff';
    context.font = 'bold 20px Arial Black, Arial, sans-serif';
    context.textAlign = 'center';
    context.fillText('GAME PAUSED — PRESS P TO CONTINUE', WIDTH / 2, 42);
    context.textAlign = 'start';
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
  healthValue.textContent = `${Math.max(0, core.lamar_health())}/${core.lamar_max_health()}`;
  boostValue.textContent = `${core.lamar_boost()}/25`;
  killsValue.textContent = String(core.lamar_kills());
  difficultyValue.textContent = ['Easy', 'Meh', 'Hard'][selectedDifficulty - 1];
}

function frame(now) {
  const dt = Math.min((now - lastFrameTime) / 1000, 0.05);
  lastFrameTime = now;

  if (screen === 'playing' && core.lamar_state() === CORE_PLAYING) {
    core.lamar_update(dt);
  }

  if (screen === 'playing') {
    const currentCoreState = core.lamar_state();
    if (currentCoreState !== previousCoreState) {
      if (currentCoreState === CORE_DEAD) {
        status.textContent =
          'Lamar crashed. Press R or tap left to retry; Q or tap right to quit.';
      }
      previousCoreState = currentCoreState;
    }
  }

  context.imageSmoothingEnabled = true;
  if (screen === 'loading') drawMessage('Loading Lamar…');
  else if (screen === 'error') drawMessage('Lamar could not launch');
  else if (screen === 'title') drawTitle();
  else if (screen === 'difficulty') drawDifficulty();
  else if (screen === 'playing') drawGame();
  else if (screen === 'quit') drawQuit();
  updateHud();
  requestAnimationFrame(frame);
}

function bindTouchControl(button) {
  const action = button.dataset.action;
  const release = () => {
    if (action === 'up') setMovement(INPUT_UP, false);
    if (action === 'down') setMovement(INPUT_DOWN, false);
  };

  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    if (action === 'up') {
      core.lamar_nudge_player(-1);
      setMovement(INPUT_UP, true);
    }
    if (action === 'down') {
      core.lamar_nudge_player(1);
      setMovement(INPUT_DOWN, true);
    }
    if (action === 'fire' && screen === 'playing') core.lamar_fire();
    if (action === 'pause' && screen === 'playing') {
      core.lamar_toggle_pause();
      status.textContent =
        core.lamar_state() === CORE_PAUSED ? 'Game paused.' : 'Game resumed.';
    }
  });
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
}

audioToggle.addEventListener('click', toggleMusic);
canvas.addEventListener('click', onCanvasClick);
window.addEventListener('keydown', onKeyDown, { passive: false });
window.addEventListener('keyup', onKeyUp, { passive: false });
document.querySelectorAll('[data-action]').forEach(bindTouchControl);
document.addEventListener('visibilitychange', () => {
  if (document.hidden && screen === 'playing' && core.lamar_state() === CORE_PLAYING) {
    core.lamar_toggle_pause();
  }
});

requestAnimationFrame(frame);
initialize();
