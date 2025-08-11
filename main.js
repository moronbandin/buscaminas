const GEOJSON_PATH = 'assets/galicia.geojson';
const ICON_EUCALIPTO = 'assets/icons/eucalipto.png';
const ICON_LUME = 'assets/icons/lume.png';

// Tamaño do grid
const BASE_ROWS = 36;
const BASE_COLS = 36;

// % de minas dentro de Galicia por dificultade
const DIFF = {
  easy:   0.12,
  medium: 0.17,
  hard:   0.22
};

// Mensaxes aleatorias ao perder
const LOSE_MESSAGES = [
  "🔥 A Xunta declarou que o lume foi ‘controlado’... dende Madrid.",
  "📄 Un novo PXOM converteu a fraga en chalés adosados.",
  "🏭 A celulosa pediu madeira ‘de proximidade’ para aforrar transporte.",
  "💶 Subvención europea para ‘bioeconomía’... a base de eucalipto.",
  "🚜 Alguén confundiu o monte cun campo de golf.",
  "🌲 Plantación experimental: 100% eucalipto, 0% sentido común.",
  "🔥 Prendeuse lume para recalificar o terreo.",
  "📉 ENCE estaba en números vermellos e precisaba madeira.",
  "🏭 ALTRI precisaba pasta de celulosa con urxencia.",
  "💰 O lobby eucalipteiro conseguiu outra plantación masiva."
];

// Pequeno carrusel de datos (sen cifras exactas para non inventar)
const FACTS = [
  "🌿 O eucalipto é unha especie exótica en Galicia; medra rápido pero reduce a biodiversidade se se planta en monocultivo.",
  "🔥 A maioría dos incendios concéntranse no verán, favorecidos por períodos de seca e ventos.",
  "🌳 Bosques diversos (carballos, castiñeiros, bidueiros) reteñen mellor a humidade e son máis resistentes ao lume.",
  "💧 A cobertura de solo e os ríos de ribeira actúan como cortalumes naturais cando están ben conservados.",
  "👥 A xestión comunitaria e a prevención local son claves para reducir o risco de incendios.",
  "🧩 Os mosaicos de usos (agrario, forestal, urbano) ben planificados reducen a continuidade do combustible.",
];

let grid = [];            // [r][c] -> { inGalicia, revealed, flagged, isMine, adj, showEucalyptus }
let nRows = BASE_ROWS, nCols = BASE_COLS;
let insideCells = [];
let mineCount = 0;
let revealedCount = 0;
let flagCount = 0;
let gameOver = false;
let lastLostCell = null;
let factsTimer = null;

const statusEl = () => document.getElementById('status');
const gridEl   = () => document.getElementById('galicia-grid');
const gameContainer = () => document.getElementById('game-container');

// Stats panel elements
const elTotalMines   = () => document.getElementById('stat-total-mines');
const elFlagsPlaced  = () => document.getElementById('stat-flags-placed');
const elMinesRemain  = () => document.getElementById('stat-mines-remain');
const elProgressText = () => document.getElementById('progress-text');
const elProgressBar  = () => document.getElementById('progress-fill');
const elFact         = () => document.getElementById('fact-line');

let ro = null; // ResizeObserver

document.addEventListener('DOMContentLoaded', () => {
  const resetBtn = document.getElementById('reset');
  if (resetBtn) resetBtn.textContent = "🌱 Reforestar";

  document.getElementById('reset').addEventListener('click', start);
  document.getElementById('difficulty').addEventListener('change', start);
  start();

  // Observa cambios reais de tamaño do contedor (moi útil en móbil/rotación)
  if (!ro) {
    ro = new ResizeObserver(() => renderGrid());
    ro.observe(gameContainer());
  }
  // fallback extra
  window.addEventListener('orientationchange', () => setTimeout(renderGrid, 100));
});

async function start() {
  try {
    statusEl().textContent = '';
    gameOver = false;
    lastLostCell = null;
    flagCount = 0;
    revealedCount = 0;

    // reinicia carrusel de facts
    if (factsTimer) clearInterval(factsTimer);
    rotateFact(); // pon un xa
    factsTimer = setInterval(rotateFact, 12000);

    const res = await fetch(GEOJSON_PATH);
    if(!res.ok) throw new Error('GeoJSON not found');
    const geojson = await res.json();

    const coords = flattenMultiPolygon(geojson.features[0].geometry);
    const [minX, minY, maxX, maxY] = bbox(coords);

    grid = Array.from({length: nRows}, () =>
      Array.from({length: nCols}, () => ({
        inGalicia: false, revealed: false, flagged: false, isMine: false, adj: 0, showEucalyptus: false
      }))
    );
    insideCells = [];

    for (let r = 0; r < nRows; r++) {
      for (let c = 0; c < nCols; c++) {
        const x = minX + (c + 0.5) * (maxX - minX) / nCols;
        const y = maxY - (r + 0.5) * (maxY - minY) / nRows;
        if (pointInMultiPolygon([x, y], geojson.features[0].geometry.coordinates)) {
          grid[r][c].inGalicia = true;
          insideCells.push([r, c]);
        }
      }
    }

    const diffKey = document.getElementById('difficulty').value;
    const targetMines = Math.max(1, Math.round(insideCells.length * DIFF[diffKey]));
    placeMines(targetMines);
    calcAdj();

    renderGrid();
    updateStats(); // inicializa panel
  } catch (e) {
    console.error(e);
    statusEl().textContent = 'Erro cargando o mapa (GeoJSON). Lembra abrir cun servidor local.';
  }
}

function placeMines(target) {
  mineCount = 0;
  for (const [r,c] of insideCells) {
    Object.assign(grid[r][c], { isMine: false, revealed: false, flagged: false, showEucalyptus: false });
  }
  const bag = insideCells.slice();
  shuffle(bag);
  let i = 0;
  while (mineCount < target && i < bag.length) {
    const [r, c] = bag[i++];
    grid[r][c].isMine = true;
    mineCount++;
  }
}

function calcAdj() {
  for (const [r,c] of insideCells) {
    if (grid[r][c].isMine) { grid[r][c].adj = 0; continue; }
    let a = 0;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const rr = r + dr, cc = c + dc;
        if (rr < 0 || rr >= nRows || cc < 0 || cc >= nCols) continue;
        if (!grid[rr][cc].inGalicia) continue;
        if (grid[rr][cc].isMine) a++;
      }
    }
    grid[r][c].adj = a;
  }
}

function renderGrid() {
  const gridNode = gridEl();
  gridNode.innerHTML = '';

  // Mide o espazo dispoñible REAL do contedor de xogo
  const gc = gameContainer();
  const vw = Math.max(0, gc.clientWidth - 8);
  const vh = Math.max(0, gc.clientHeight - 8);

  // Tamaño de cela responsivo con límites
  let cellSize = Math.min(vw / nCols, vh / nRows);
  const MIN = 22; // toque cómodo en móbil
  const MAX = 44; // non xigante en desktop
  cellSize = Math.max(MIN, Math.min(MAX, Math.floor(cellSize)));

  gridNode.style.gridTemplateRows = `repeat(${nRows}, ${cellSize}px)`;
  gridNode.style.gridTemplateColumns = `repeat(${nCols}, ${cellSize}px)`;

  const setIcon = (div, url, scale = 0.78) => {
    const px = Math.floor(cellSize * scale);
    div.style.backgroundImage = `url("${url}")`;
    div.style.backgroundRepeat = 'no-repeat';
    div.style.backgroundPosition = 'center';
    div.style.backgroundSize = `${px}px ${px}px`;
  };
  const setCover = (div, url) => {
    div.style.backgroundImage = `url("${url}")`;
    div.style.backgroundRepeat = 'no-repeat';
    div.style.backgroundPosition = 'center';
    div.style.backgroundSize = 'cover';
  };

  for (let r = 0; r < nRows; r++) {
    for (let c = 0; c < nCols; c++) {
      const d = grid[r][c];
      const div = document.createElement('div');
      div.className = 'cell';
      div.style.width = div.style.height = cellSize + 'px';

      if (!d.inGalicia) {
        div.classList.add('disabled');
      } else {
        if (gameOver && !d.revealed) {
          setCover(div, ICON_LUME);
        }
        else if (d.revealed && d.isMine) {
          div.classList.add('mine');
          setCover(div, ICON_LUME);
          if (lastLostCell && lastLostCell[0] === r && lastLostCell[1] === c) div.classList.add('lost');
        }
        else if (d.revealed) {
          div.classList.add('revealed');
          if (d.adj > 0) {
            div.style.fontSize = Math.floor(cellSize * 0.55) + 'px';
            div.textContent = d.adj;
          } else {
            if (d.showEucalyptus) setIcon(div, ICON_EUCALIPTO, 0.80);
            else div.classList.add('zero');
          }
        }
        else if (d.flagged) {
          div.textContent = '🚩';
          div.style.fontSize = Math.floor(cellSize * 0.6) + 'px';
        }
      }

      div.onclick = () => { if (!gameOver) onClick(r, c); };
      div.oncontextmenu = e => { e.preventDefault(); if (!gameOver) onFlag(r, c); };
      gridNode.appendChild(div);
    }
  }
}

function onClick(r, c) {
  const cell = grid[r][c];
  if (!cell.inGalicia || cell.revealed || cell.flagged) return;

  cell.revealed = true;
  if (cell.isMine) {
    gameOver = true;
    lastLostCell = [r, c];
    statusEl().innerHTML = LOSE_MESSAGES[Math.floor(Math.random() * LOSE_MESSAGES.length)];
    revealAll();
  } else {
    revealedCount++;
    if (cell.adj === 0) {
      cell.showEucalyptus = true;
      floodReveal(r, c);
    }
    const safeTotal = insideCells.length - mineCount;
    if (revealedCount >= safeTotal) {
      gameOver = true;
      statusEl().innerHTML = '✅ Parabéns! Galicia a salvo.';
      revealAll(true);
    }
  }
  renderGrid();
  updateStats();
}

function floodReveal(r, c) {
  const stack = [[r, c]];
  while (stack.length) {
    const [rr, cc] = stack.pop();
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = rr + dr, nc = cc + dc;
        if (nr < 0 || nr >= nRows || nc < 0 || nc >= nCols) continue;
        const n = grid[nr][nc];
        if (!n.inGalicia || n.revealed || n.flagged || n.isMine) continue;
        n.revealed = true;
        revealedCount++;
        if (n.adj === 0) {
          n.showEucalyptus = true;
          stack.push([nr, nc]);
        }
      }
    }
  }
}

function onFlag(r, c) {
  const cell = grid[r][c];
  if (!cell.inGalicia || cell.revealed) return;
  cell.flagged = !cell.flagged;
  flagCount += cell.flagged ? 1 : -1;
  renderGrid();
  updateStats();
}

function revealAll() {
  for (const [r, c] of insideCells) grid[r][c].revealed = true;
  renderGrid();
  updateStats();
}

/* ======= NOVO: Panel de estatísticas ======= */
function updateStats() {
  if (!elTotalMines()) return; // por se aínda non cargou o DOM

  const safeTotal = Math.max(1, insideCells.length - mineCount);
  const pct = Math.min(100, Math.max(0, Math.round((revealedCount / safeTotal) * 100)));

  // Contadores
  elTotalMines().textContent  = mineCount.toString();
  elFlagsPlaced().textContent = flagCount.toString();
  elMinesRemain().textContent = Math.max(0, mineCount - flagCount).toString();

  // Progreso “salvando Galicia”
  elProgressText().textContent = `${pct}% de celas seguras reveladas`;
  elProgressBar().style.width = pct + '%';

  // Se fin do xogo, texto acorde
  if (gameOver) {
    if (revealedCount >= safeTotal) {
      elProgressText().textContent = '✅ Galicia a salvo!';
      elProgressBar().style.width = '100%';
    } else {
      elProgressText().textContent = '💥 Interrompido por un incendio';
    }
  }
}

function rotateFact() {
  if (!elFact()) return;
  const i = Math.floor(Math.random() * FACTS.length);
  elFact().textContent = FACTS[i];
}

/* Utilidades Geo */
function flattenMultiPolygon(geom) {
  const out = [];
  for (const polygon of geom.coordinates) {
    for (const ring of polygon) {
      for (const [x, y] of ring) out.push([x, y]);
    }
  }
  return out;
}

function bbox(coords) {
  let minX =  Infinity, minY =  Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x,y] of coords) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return [minX, minY, maxX, maxY];
}

function pointInMultiPolygon(pt, multiCoords) {
  for (const polygon of multiCoords) {
    let insideOuter = rayCast(pt, polygon[0]);
    if (!insideOuter) continue;
    let inHole = false;
    for (let i = 1; i < polygon.length; i++) {
      if (rayCast(pt, polygon[i])) { inHole = true; break; }
    }
    if (insideOuter && !inHole) return true;
  }
  return false;
}
function rayCast(pt, ring) {
  const x = pt[0], y = pt[1];
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    const intersect = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-12) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/* Util varias */
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [a[i],a[j]]=[a[j],a[i]]; } }
