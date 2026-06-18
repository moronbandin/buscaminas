import {
  bbox,
  calcAdjacencies,
  floodReveal,
  flattenMultiPolygon,
  hasWon,
  placeMines,
  pointInMultiPolygon,
  protectFirstMove,
} from './game-core.js';

const GEOJSON_PATH = 'assets/galicia.geojson';
const ICON_EUCALIPTO = 'assets/icons/eucalipto.png';
const ICON_LUME = 'assets/icons/lume.png';
const ROWS = 36;
const COLS = 36;
const DIFFICULTIES = { easy: 0.12, medium: 0.17, hard: 0.22 };

const LOSE_MESSAGES = [
  '🔥 A Xunta declarou que o lume foi “controlado”… dende Madrid.',
  '📄 Un novo PXOM converteu a fraga en chalés adosados.',
  '🏭 A celulosa pediu madeira “de proximidade” para aforrar transporte.',
  '💶 Subvención europea para “bioeconomía”… a base de eucalipto.',
  '🚜 Alguén confundiu o monte cun campo de golf.',
  '🌲 Plantación experimental: 100% eucalipto, 0% sentido común.',
  '🔥 Prendeuse lume para recalificar o terreo.',
  '📉 ENCE estaba en números vermellos e precisaba madeira.',
  '🏭 ALTRI precisaba pasta de celulosa con urxencia.',
  '💰 O lobby eucalipteiro conseguiu outra plantación masiva.',
];

const FACTS = [
  '🌿 O eucalipto é unha especie exótica en Galicia; os monocultivos reducen a diversidade do territorio.',
  '🔥 A seca, a calor, o vento e a continuidade do combustible aumentan o risco de grandes incendios.',
  '🌳 Os bosques diversos adoitan responder mellor ás perturbacións ca unha plantación uniforme.',
  '💧 A vexetación de ribeira e os solos ben conservados axudan a reter humidade.',
  '👥 A xestión comunitaria e a prevención local son claves para reducir o risco de incendios.',
  '🧩 Os mosaicos de usos agrarios e forestais poden frear a continuidade do combustible.',
];

const elements = {
  difficulty: document.getElementById('difficulty'),
  fact: document.getElementById('fact-line'),
  flagMode: document.getElementById('flag-mode'),
  game: document.getElementById('game-container'),
  grid: document.getElementById('galicia-grid'),
  minesRemain: document.getElementById('stat-mines-remain'),
  progressBar: document.getElementById('progress-fill'),
  progressText: document.getElementById('progress-text'),
  reset: document.getElementById('reset'),
  status: document.getElementById('status'),
  flagsPlaced: document.getElementById('stat-flags-placed'),
  totalMines: document.getElementById('stat-total-mines'),
};

let grid = [];
let insideCells = [];
let cellNodes = [];
let mineCount = 0;
let revealedCount = 0;
let flagCount = 0;
let firstMove = true;
let gameOver = false;
let won = false;
let flagMode = false;
let lastLostCell = null;
let factsTimer = null;
let geojsonPromise = null;
let startSequence = 0;
let longPressTimer = null;
let suppressNextClick = false;

elements.reset.addEventListener('click', start);
elements.difficulty.addEventListener('change', start);
elements.flagMode.addEventListener('click', toggleFlagMode);
window.addEventListener('resize', resizeGrid, { passive: true });
window.addEventListener('beforeunload', () => clearInterval(factsTimer));

start();

async function start() {
  const sequence = ++startSequence;
  setStatus('Preparando o monte…', 'neutral');
  elements.grid.setAttribute('aria-busy', 'true');

  try {
    const geojson = await loadGeojson();
    if (sequence !== startSequence) return;

    resetState();
    buildBoardShape(geojson);
    const target = Math.max(
      1,
      Math.round(insideCells.length * DIFFICULTIES[elements.difficulty.value]),
    );
    mineCount = placeMines(grid, insideCells, target);
    calcAdjacencies(grid, insideCells);
    buildGridDom();
    resizeGrid();
    renderAllCells();
    updateStats();
    setStatus('Primeiro movemento seguro. Boa sorte!', 'neutral');
    elements.grid.setAttribute('aria-busy', 'false');
    rotateFact();
    clearInterval(factsTimer);
    factsTimer = setInterval(rotateFact, 12000);
  } catch (error) {
    console.error(error);
    elements.grid.setAttribute('aria-busy', 'false');
    setStatus('Non se puido cargar o mapa. Abre o proxecto cun servidor local.', 'error');
  }
}

function loadGeojson() {
  if (!geojsonPromise) {
    geojsonPromise = fetch(GEOJSON_PATH).then((response) => {
      if (!response.ok) throw new Error(`GeoJSON: ${response.status}`);
      return response.json();
    });
  }
  return geojsonPromise;
}

function resetState() {
  grid = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({
      inGalicia: false,
      revealed: false,
      flagged: false,
      isMine: false,
      adj: 0,
    })),
  );
  insideCells = [];
  cellNodes = [];
  revealedCount = 0;
  flagCount = 0;
  firstMove = true;
  gameOver = false;
  won = false;
  lastLostCell = null;
  setFlagMode(false);
}

function buildBoardShape(geojson) {
  const geometry = geojson.features?.[0]?.geometry;
  if (!geometry || geometry.type !== 'MultiPolygon') {
    throw new Error('O GeoJSON non contén un MultiPolygon válido');
  }

  const [minX, minY, maxX, maxY] = bbox(flattenMultiPolygon(geometry));
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const x = minX + ((col + 0.5) * (maxX - minX)) / COLS;
      const y = maxY - ((row + 0.5) * (maxY - minY)) / ROWS;
      if (pointInMultiPolygon([x, y], geometry.coordinates)) {
        grid[row][col].inGalicia = true;
        insideCells.push([row, col]);
      }
    }
  }
}

function buildGridDom() {
  const fragment = document.createDocumentFragment();
  elements.grid.replaceChildren();
  cellNodes = Array.from({ length: ROWS }, () => Array(COLS));

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const cell = grid[row][col];
      const node = cell.inGalicia
        ? document.createElement('button')
        : document.createElement('span');

      node.className = cell.inGalicia ? 'cell' : 'cell disabled';
      node.dataset.row = row;
      node.dataset.col = col;

      if (cell.inGalicia) {
        node.type = 'button';
        node.setAttribute('role', 'gridcell');
        node.addEventListener('click', () => handleCellAction(row, col));
        node.addEventListener('contextmenu', (event) => {
          event.preventDefault();
          toggleFlag(row, col);
        });
        node.addEventListener('pointerdown', (event) => startLongPress(event, row, col));
        node.addEventListener('pointerup', cancelLongPress);
        node.addEventListener('pointercancel', cancelLongPress);
        node.addEventListener('pointerleave', cancelLongPress);
      } else {
        node.setAttribute('aria-hidden', 'true');
      }

      cellNodes[row][col] = node;
      fragment.appendChild(node);
    }
  }

  elements.grid.appendChild(fragment);
}

function resizeGrid() {
  if (!grid.length) return;
  const width = Math.max(0, elements.game.clientWidth - 24);
  const height = Math.max(0, elements.game.clientHeight - 24);
  const compact = window.matchMedia('(max-width: 760px)').matches;
  const minimum = compact ? 22 : 12;
  const fitted = Math.floor(Math.min(width / COLS, height / ROWS));
  const cellSize = Math.max(minimum, Math.min(32, fitted));

  elements.grid.style.setProperty('--cell-size', `${cellSize}px`);
  elements.grid.style.gridTemplateColumns = `repeat(${COLS}, var(--cell-size))`;
  elements.grid.style.gridTemplateRows = `repeat(${ROWS}, var(--cell-size))`;
}

function handleCellAction(row, col) {
  if (suppressNextClick) {
    suppressNextClick = false;
    return;
  }
  if (flagMode) toggleFlag(row, col);
  else reveal(row, col);
}

function reveal(row, col) {
  const cell = grid[row][col];
  if (gameOver || !cell.inGalicia || cell.revealed || cell.flagged) return;

  if (firstMove) {
    protectFirstMove(grid, insideCells, row, col);
    calcAdjacencies(grid, insideCells);
    firstMove = false;
  }

  if (cell.isMine) {
    cell.revealed = true;
    gameOver = true;
    lastLostCell = [row, col];
    setStatus(LOSE_MESSAGES[Math.floor(Math.random() * LOSE_MESSAGES.length)], 'error');
  } else {
    const changed = floodReveal(grid, row, col);
    revealedCount += changed.length;
    if (hasWon(insideCells, mineCount, revealedCount)) {
      gameOver = true;
      won = true;
      setStatus('✅ Parabéns! Galicia a salvo.', 'success');
    }
  }

  renderAllCells();
  updateStats();
}

function toggleFlag(row, col) {
  const cell = grid[row][col];
  if (gameOver || !cell.inGalicia || cell.revealed) return;
  cell.flagged = !cell.flagged;
  flagCount += cell.flagged ? 1 : -1;
  renderCell(row, col);
  updateStats();
}

function startLongPress(event, row, col) {
  if (event.pointerType === 'mouse' || gameOver) return;
  cancelLongPress();
  longPressTimer = setTimeout(() => {
    suppressNextClick = true;
    toggleFlag(row, col);
    navigator.vibrate?.(35);
  }, 500);
}

function cancelLongPress() {
  clearTimeout(longPressTimer);
  longPressTimer = null;
}

function toggleFlagMode() {
  setFlagMode(!flagMode);
}

function setFlagMode(active) {
  flagMode = active;
  elements.flagMode.setAttribute('aria-pressed', String(active));
  elements.flagMode.classList.toggle('active', active);
  elements.flagMode.textContent = active ? '🚩 Marcando' : '🚩 Bandeira';
}

function renderAllCells() {
  for (const [row, col] of insideCells) renderCell(row, col);
}

function renderCell(row, col) {
  const cell = grid[row][col];
  const node = cellNodes[row]?.[col];
  if (!node) return;

  const lost = lastLostCell?.[0] === row && lastLostCell?.[1] === col;
  const showMine = gameOver && cell.isMine;
  const wrongFlag = gameOver && cell.flagged && !cell.isMine;

  node.className = 'cell';
  node.textContent = '';
  node.style.backgroundImage = '';
  node.disabled = gameOver || cell.revealed;

  if (lost) node.classList.add('lost');
  if (wrongFlag) {
    node.classList.add('wrong-flag');
    node.textContent = '✕';
  } else if (showMine) {
    node.classList.add('mine');
    node.style.backgroundImage = `url("${won ? ICON_EUCALIPTO : ICON_LUME}")`;
  } else if (cell.revealed) {
    node.classList.add('revealed');
    if (cell.adj > 0) {
      node.textContent = cell.adj;
      node.dataset.adj = cell.adj;
    } else {
      node.classList.add('zero');
    }
  } else if (cell.flagged) {
    node.classList.add('flagged');
    node.textContent = '🚩';
  }

  node.setAttribute('aria-label', cellLabel(cell, row, col, wrongFlag, showMine));
  node.setAttribute('aria-pressed', String(cell.flagged));
}

function cellLabel(cell, row, col, wrongFlag, showMine) {
  const position = `Fila ${row + 1}, columna ${col + 1}`;
  if (wrongFlag) return `${position}: bandeira incorrecta`;
  if (showMine) return `${position}: mina`;
  if (cell.flagged) return `${position}: marcada cunha bandeira`;
  if (!cell.revealed) return `${position}: cela sen revelar`;
  if (cell.adj === 0) return `${position}: zona segura, sen minas próximas`;
  return `${position}: zona segura, ${cell.adj} minas próximas`;
}

function updateStats() {
  const safeTotal = Math.max(1, insideCells.length - mineCount);
  const percentage = Math.min(100, Math.round((revealedCount / safeTotal) * 100));

  elements.totalMines.textContent = mineCount;
  elements.flagsPlaced.textContent = flagCount;
  elements.minesRemain.textContent = Math.max(0, mineCount - flagCount);
  elements.progressBar.style.width = `${percentage}%`;
  elements.progressBar.parentElement.setAttribute('aria-valuenow', String(percentage));
  elements.progressText.textContent = `${percentage}% de zonas seguras`;

  if (gameOver) {
    elements.progressText.textContent = won
      ? '✅ Galicia a salvo!'
      : '💥 Partida interrompida';
    if (won) elements.progressBar.style.width = '100%';
  }
}

function setStatus(message, type) {
  elements.status.textContent = message;
  elements.status.dataset.type = type;
}

function rotateFact() {
  elements.fact.textContent = FACTS[Math.floor(Math.random() * FACTS.length)];
}
