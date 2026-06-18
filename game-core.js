export function placeMines(grid, insideCells, target, random = Math.random) {
  for (const [row, col] of insideCells) grid[row][col].isMine = false;
  const bag = [...insideCells];
  shuffle(bag, random);
  const count = Math.min(target, bag.length);
  for (let index = 0; index < count; index++) {
    const [row, col] = bag[index];
    grid[row][col].isMine = true;
  }
  return count;
}

export function calcAdjacencies(grid, insideCells) {
  for (const [row, col] of insideCells) {
    const cell = grid[row][col];
    cell.adj = cell.isMine
      ? 0
      : neighbours(grid, row, col).filter(([r, c]) => grid[r][c].isMine).length;
  }
}

export function protectFirstMove(grid, insideCells, row, col) {
  const clicked = grid[row][col];
  if (!clicked.isMine) return false;
  const replacement = insideCells.find(
    ([r, c]) => !grid[r][c].isMine && (r !== row || c !== col),
  );
  if (!replacement) return false;
  clicked.isMine = false;
  grid[replacement[0]][replacement[1]].isMine = true;
  return true;
}

export function floodReveal(grid, startRow, startCol) {
  const start = grid[startRow]?.[startCol];
  if (!start?.inGalicia || start.revealed || start.flagged || start.isMine) return [];

  const changed = [];
  const stack = [[startRow, startCol]];
  while (stack.length) {
    const [row, col] = stack.pop();
    const cell = grid[row][col];
    if (cell.revealed || cell.flagged || cell.isMine) continue;
    cell.revealed = true;
    changed.push([row, col]);
    if (cell.adj === 0) {
      for (const [nextRow, nextCol] of neighbours(grid, row, col)) {
        const next = grid[nextRow][nextCol];
        if (next.inGalicia && !next.revealed && !next.flagged && !next.isMine) {
          stack.push([nextRow, nextCol]);
        }
      }
    }
  }
  return changed;
}

export function hasWon(insideCells, mineCount, revealedCount) {
  return revealedCount >= insideCells.length - mineCount;
}

export function neighbours(grid, row, col) {
  const result = [];
  for (let rowDelta = -1; rowDelta <= 1; rowDelta++) {
    for (let colDelta = -1; colDelta <= 1; colDelta++) {
      if (rowDelta === 0 && colDelta === 0) continue;
      const nextRow = row + rowDelta;
      const nextCol = col + colDelta;
      if (
        nextRow >= 0 &&
        nextRow < grid.length &&
        nextCol >= 0 &&
        nextCol < grid[nextRow].length &&
        grid[nextRow][nextCol].inGalicia
      ) {
        result.push([nextRow, nextCol]);
      }
    }
  }
  return result;
}

export function flattenMultiPolygon(geometry) {
  return geometry.coordinates.flatMap((polygon) =>
    polygon.flatMap((ring) => ring.map(([x, y]) => [x, y])),
  );
}

export function bbox(coords) {
  return coords.reduce(
    ([minX, minY, maxX, maxY], [x, y]) => [
      Math.min(minX, x),
      Math.min(minY, y),
      Math.max(maxX, x),
      Math.max(maxY, y),
    ],
    [Infinity, Infinity, -Infinity, -Infinity],
  );
}

export function pointInMultiPolygon(point, multiPolygon) {
  return multiPolygon.some((polygon) => {
    if (!rayCast(point, polygon[0])) return false;
    return !polygon.slice(1).some((hole) => rayCast(point, hole));
  });
}

function rayCast([x, y], ring) {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const [x1, y1] = ring[index];
    const [x2, y2] = ring[previous];
    const intersects =
      (y1 > y) !== (y2 > y) &&
      x < ((x2 - x1) * (y - y1)) / (y2 - y1 || Number.EPSILON) + x1;
    if (intersects) inside = !inside;
  }
  return inside;
}

function shuffle(items, random) {
  for (let index = items.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(random() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
}
