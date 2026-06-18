import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calcAdjacencies,
  floodReveal,
  hasWon,
  placeMines,
  protectFirstMove,
} from '../game-core.js';

function board(rows, cols) {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({
      inGalicia: true,
      revealed: false,
      flagged: false,
      isMine: false,
      adj: 0,
    })),
  );
}

test('placeMines respecta o número solicitado', () => {
  const grid = board(2, 2);
  const inside = [[0, 0], [0, 1], [1, 0], [1, 1]];
  assert.equal(placeMines(grid, inside, 2, () => 0), 2);
  assert.equal(grid.flat().filter((cell) => cell.isMine).length, 2);
});

test('calcAdjacencies conta só as minas veciñas', () => {
  const grid = board(3, 3);
  const inside = grid.flatMap((row, r) => row.map((_, c) => [r, c]));
  grid[0][0].isMine = true;
  calcAdjacencies(grid, inside);
  assert.equal(grid[0][1].adj, 1);
  assert.equal(grid[1][1].adj, 1);
  assert.equal(grid[2][2].adj, 0);
});

test('protectFirstMove move unha mina sen alterar o total', () => {
  const grid = board(2, 2);
  const inside = [[0, 0], [0, 1], [1, 0], [1, 1]];
  grid[0][0].isMine = true;
  assert.equal(protectFirstMove(grid, inside, 0, 0), true);
  assert.equal(grid[0][0].isMine, false);
  assert.equal(grid.flat().filter((cell) => cell.isMine).length, 1);
});

test('floodReveal expande os ceros e detense ante unha mina', () => {
  const grid = board(3, 3);
  const inside = grid.flatMap((row, r) => row.map((_, c) => [r, c]));
  grid[0][0].isMine = true;
  calcAdjacencies(grid, inside);
  const changed = floodReveal(grid, 2, 2);
  assert.equal(grid[0][0].revealed, false);
  assert.equal(changed.length, 8);
});

test('hasWon compara as reveladas co total de celas seguras', () => {
  const inside = [[0, 0], [0, 1], [1, 0], [1, 1]];
  assert.equal(hasWon(inside, 1, 2), false);
  assert.equal(hasWon(inside, 1, 3), true);
});
