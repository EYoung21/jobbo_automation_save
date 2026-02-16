/**
 * JOBBO Game Automation
 * Run this in the browser console (F12) while on the game page at jobbo.n1.xyz
 * Finds player and apple in the DOM, computes shortest path, and sends arrow keys.
 */

(function () {
  'use strict';

  const ARROW_KEY_MAP = {
    up: 'ArrowUp',
    down: 'ArrowDown',
    left: 'ArrowLeft',
    right: 'ArrowRight',
  };

  const DIRS = [
    [0, -1, 'up'],
    [0, 1, 'down'],
    [-1, 0, 'left'],
    [1, 0, 'right'],
  ];

  /**
   * BFS to find shortest path from (sx,sy) to (ex,ey).
   * blocked Set<string> of "x,y" for walls.
   */
  function bfs(sx, sy, ex, ey, cols, rows, blocked) {
    blocked = blocked || new Set();
    const key = (x, y) => `${x},${y}`;
    const q = [[sx, sy, []]];
    const seen = new Set([key(sx, sy)]);

    while (q.length) {
      const [x, y, path] = q.shift();
      if (x === ex && y === ey) return path;

      for (const [dx, dy, dir] of DIRS) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
        if (blocked.has(key(nx, ny))) continue;
        if (seen.has(key(nx, ny))) continue;
        seen.add(key(nx, ny));
        q.push([nx, ny, path.concat([dir])]);
      }
    }
    return null;
  }

  function dispatchKey(keyName, target) {
    const key = keyName.startsWith('Arrow') ? keyName : ARROW_KEY_MAP[keyName];
    const keyCode = key === 'ArrowUp' ? 38 : key === 'ArrowDown' ? 40 : key === 'ArrowLeft' ? 37 : 39;
    const opts = { key, code: key, keyCode, which: keyCode, bubbles: true, cancelable: true };
    const el = target || document.activeElement || document.body;
    for (const e of [el, document.body, document, document.documentElement, window]) {
      if (e) {
        e.dispatchEvent(new KeyboardEvent('keydown', opts));
        e.dispatchEvent(new KeyboardEvent('keyup', opts));
      }
    }
  }

  const MAX_BOARD_SIZE = 60;

  function validGrid(g) {
    if (!g || g.cols > MAX_BOARD_SIZE || g.rows > MAX_BOARD_SIZE) return false;
    const [px, py] = g.getCoord(null, g.playerIndex);
    if (px >= g.cols || py >= g.rows) return false;
    return true;
  }

  /**
   * Try to find the game board and cell positions from the DOM.
   * Returns { cols, rows, cells, playerIndex, appleIndex } or null.
   */
  function discoverGrid() {
    // Strategy 0: JOBBO game - .game-board only (ignore legend in .game-left-panel)
    const gameBoard = document.querySelector('.game-board');
    if (gameBoard) {
      const gridEl = gameBoard.querySelector('.grid') || gameBoard.firstElementChild;
      if (gridEl) {
        const cells = Array.from(gridEl.children).filter((el) => el && el.classList && el.classList.contains('game-cell'));
        const styleStr = (gridEl.getAttribute && gridEl.getAttribute('style')) || '';
        const computed = typeof getComputedStyle !== 'undefined' ? getComputedStyle(gridEl).gridTemplateColumns || '' : '';
        const repeatMatch = styleStr.match(/repeat\s*\(\s*(\d+)/) || computed.match(/repeat\s*\(\s*(\d+)/);
        const cols = repeatMatch ? parseInt(repeatMatch[1], 10) : (() => { const s = Math.sqrt(cells.length); return Number.isInteger(s) ? s : 25; })();
        const rows = cells.length / cols;
        if (rows >= 1 && Number.isInteger(rows)) {
          // Use last occurrence when game has duplicate player/apple (e.g. during re-render)
          const playerIdx = cells.findLastIndex ? cells.findLastIndex((c) => c.classList.contains('player')) : (() => { let i = -1; cells.forEach((c, idx) => { if (c.classList.contains('player')) i = idx; }); return i; })();
          const appleIdx = cells.findLastIndex ? cells.findLastIndex((c) => c.classList.contains('apple')) : (() => { let i = -1; cells.forEach((c, idx) => { if (c.classList.contains('apple')) i = idx; }); return i; })();
          if (playerIdx >= 0 && appleIdx >= 0) {
            const getCoord = (_, i) => [i % cols, Math.floor(i / cols)];
            const blocked = new Set();
            cells.forEach((c, i) => { if (c.classList.contains('wall')) blocked.add(getCoord(null, i).join(',')); });
            const result = { cols, rows, cells, playerIndex: playerIdx, appleIndex: appleIdx, getCoord, blocked };
            if (validGrid(result)) return result;
          }
        }
      }
    }

    // Strategy 1: look for data attributes (common in React games)
    const byData = document.querySelector('[data-board], [data-grid], [data-cols]');
    if (byData) {
      const board = byData.querySelector('[data-board]') || byData;
      const cells = Array.from(board.querySelectorAll('[data-cell], [data-x], [data-index], [data-row]'));
      if (cells.length) {
        const boardCols = parseInt(board.dataset.cols, 10) || Math.ceil(Math.sqrt(cells.length));
        const getCoord = (el, idx) => {
          const cell = el != null ? el : cells[idx];
          if (!cell) return [0, 0];
          const x = cell.dataset.x ?? cell.dataset.col ?? cell.dataset.index;
          const y = cell.dataset.y ?? cell.dataset.row;
          if (x != null && y != null) return [parseInt(x, 10), parseInt(y, 10)];
          const i = cell.dataset.index != null ? parseInt(cell.dataset.index, 10) : cells.indexOf(cell);
          return [i % boardCols, Math.floor(i / boardCols)];
        };
        let playerIdx = -1, appleIdx = -1;
        cells.forEach((el, i) => {
          if (el.querySelector('[data-player], .player, [data-entity="player"]')) playerIdx = i;
          if (el.querySelector('[data-apple], .apple, [data-entity="apple"]')) appleIdx = i;
        });
        if (playerIdx >= 0 && appleIdx >= 0) {
          const result = { cols: boardCols, rows: Math.ceil(cells.length / boardCols), cells, playerIndex: playerIdx, appleIndex: appleIdx, getCoord };
          if (validGrid(result)) return result;
        }
      }
    }

    // Strategy 2: find a grid container by structure (many same-size children)
    const candidates = document.querySelectorAll('main, [role="main"], #__next, [class*="board"], [class*="grid"], [class*="game"]');
    for (const container of candidates) {
      const children = container.querySelectorAll('div[class], span[class]');
      const byPos = new Map();
      for (const el of children) {
        const r = el.getBoundingClientRect();
        if (r.width < 5 || r.height < 5) continue;
        const cx = Math.round(r.left + r.width / 2);
        const cy = Math.round(r.top + r.height / 2);
        const key = `${cx},${cy}`;
        if (!byPos.has(key)) byPos.set(key, []);
        byPos.get(key).push(el);
      }
      const positions = Array.from(byPos.keys()).map((k) => k.split(',').map(Number));
      if (positions.length < 4) continue;
      const xs = positions.map(([x]) => x).sort((a, b) => a - b);
      const ys = positions.map(([, y]) => y).sort((a, b) => a - b);
      const cellW = xs[1] - xs[0] || 1;
      const cellH = ys[1] - ys[0] || 1;
      const cols = Math.round((Math.max(...xs) - Math.min(...xs)) / cellW) + 1;
      const rows = Math.round((Math.max(...ys) - Math.min(...ys)) / cellH) + 1;
      if (cols * rows > 5000) continue;

      const grid = [];
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const gx = xs[0] + col * cellW;
          const gy = ys[0] + row * cellH;
          const key = `${gx},${gy}`;
          const cellsAt = byPos.get(key) || [];
          grid.push({ col, row, el: cellsAt[0], all: cellsAt });
        }
      }

      let playerIdx = -1, appleIdx = -1;
      grid.forEach((cell, i) => {
        const el = cell.el || document.elementFromPoint(
          cell.col * cellW + xs[0] + cellW / 2,
          cell.row * cellH + ys[0] + cellH / 2
        );
        if (!el) return;
        const html = (el.outerHTML || '').toLowerCase();
        const hasPlayer = html.includes('player') || el.querySelector('[class*="player"]') || (el.children.length >= 1 && el.querySelector('div, span'));
        const hasApple = html.includes('apple') || el.querySelector('[class*="apple"]');
        if (hasPlayer) playerIdx = i;
        if (hasApple) appleIdx = i;
      });

      if (playerIdx >= 0 && appleIdx >= 0) {
        const result = { cols, rows, cells: grid.map((c) => c.el), playerIndex: playerIdx, appleIndex: appleIdx, getCoord: (_, i) => [grid[i].col, grid[i].row] };
        if (validGrid(result)) return result;
      }
    }

    // Strategy 3: flat list of cells (e.g. divs with same class in a wrapper)
    const flatContainers = document.querySelectorAll('[class*="board"], [class*="grid"], [class*="Board"], [class*="Grid"]');
    for (const cont of flatContainers) {
      const cells = Array.from(cont.children).filter((el) => el.tagName === 'DIV' || el.tagName === 'SPAN');
      if (cells.length < 4 || cells.length > 10000) continue;
      const first = cells[0].getBoundingClientRect();
      const sameSize = cells.every((c) => {
        const r = c.getBoundingClientRect();
        return Math.abs(r.width - first.width) < 2 && Math.abs(r.height - first.height) < 2;
      });
      if (!sameSize) continue;
      const cols = Math.round(cont.getBoundingClientRect().width / first.width) || 1;
      const rows = Math.ceil(cells.length / cols);
      let playerIdx = -1, appleIdx = -1;
      cells.forEach((el, i) => {
        const text = (el.textContent || '').trim();
        const cls = (el.className || '').toLowerCase();
        const hasPlayer = cls.includes('player') || el.querySelector('[class*="player"]') || (el.children.length >= 1 && /player|character|you/.test(cls + text));
        const hasApple = cls.includes('apple') || el.querySelector('[class*="apple"]') || /apple|fruit|goal/.test(cls + text);
        if (hasPlayer) playerIdx = i;
        if (hasApple) appleIdx = i;
      });
      if (playerIdx >= 0 && appleIdx >= 0) {
        const result = { cols, rows, cells, playerIndex: playerIdx, appleIndex: appleIdx, getCoord: (_, i) => [i % cols, Math.floor(i / cols)] };
        if (validGrid(result)) return result;
      }
    }

    // Strategy 4: React fiber state (Next.js)
    const root = document.getElementById('__next') || document.querySelector('#root');
    if (root && root._reactRootContainer) {
      const walk = (node, depth) => {
        if (depth > 25) return null;
        if (node && node.memoizedState && typeof node.memoizedState === 'object') {
          const s = node.memoizedState;
          if (s.board && s.player != null && s.apple != null) return s;
          return walk(node.child, depth + 1) || walk(node.sibling, depth + 1);
        }
        return node ? walk(node.child, depth + 1) || walk(node.sibling, depth + 1) : null;
      };
      const state = walk(root._reactRootContainer?._internalRoot?.current, 0);
      if (state) return state;
    }

    return null;
  }

  /**
   * Run one step: compute path and execute moves with delay.
   * Calls onDone() when the full move sequence has been sent (optional).
   */
  function runStep(delayMs = 10, onDone) {
    const grid = discoverGrid();
    if (!grid) {
      console.warn('JOBBO: Could not find game grid. Make sure you are on the game board and the board is visible.');
      return;
    }

    const { cols, rows, playerIndex, appleIndex, getCoord, cells, blocked } = grid;
    const [px, py] = getCoord(null, playerIndex);
    const [ax, ay] = getCoord(null, appleIndex);
    const path = bfs(px, py, ax, ay, cols, rows, blocked || null);
    if (!path) {
      console.warn('JOBBO: No path found (walls?).');
      return;
    }

    var keyTarget = (cells && cells[0]) ? (cells[0].closest && cells[0].closest('.game-board')) : null;
    if (keyTarget && !keyTarget.hasAttribute('tabindex')) {
      keyTarget.setAttribute('tabindex', '-1');
    }
    if (keyTarget && typeof keyTarget.focus === 'function') {
      keyTarget.focus();
    }
    if (typeof window.focus === 'function') {
      window.focus();
    }

    console.log(`JOBBO: Player (${px},${py}) -> Apple (${ax},${ay}), path length ${path.length}`);
    let i = 0;
    function sendNext() {
      if (i >= path.length) {
        console.log('JOBBO: Move sequence done.');
        if (typeof onDone === 'function') onDone();
        return;
      }
      dispatchKey(path[i], keyTarget);
      i++;
      setTimeout(sendNext, delayMs);
    }
    sendNext();
  }

  function getCurrentLevel() {
    const statDisplays = document.querySelectorAll('.stat-display');
    for (const row of statDisplays) {
      const text = (row.textContent || '').trim();
      if (text.startsWith('LEVEL:')) {
        const num = parseInt(text.replace(/\D/g, ''), 10);
        if (!isNaN(num)) return num;
      }
    }
    return null;
  }

  /**
   * After reaching apple: wait for the level to change, then wait for the *board* to actually
   * show the new level (grid key different from completed level) and stay stable. Avoids running
   * on the previous level's DOM when only the level label has updated.
   */
  function waitForLevelReadyThenRun(delayMs, levelCheckIntervalMs, levelWhenDone, gridKeyWhenDone) {
    const RESUME_DELAY_MS = 25;   // check very soon after move sequence done
    const POLL_MS = 15;           // poll level often when waiting for change
    const MAX_WAIT_MS = 3500;
    const BOARD_POLL_MS = 12;     // poll board stability frequently
    const BOARD_STABLE_MS = 22;   // same grid for this long = safe to run
    const BOARD_STABLE_MAX_MS = 400; // max wait for new board to appear and stabilize

    function runNow() {
      runLoop(delayMs, levelCheckIntervalMs);
    }

    function tryResume() {
      const level = getCurrentLevel();
      if (level != null && level >= 1000) {
        console.log('JOBBO: Reached level 1000. Stopping.');
        return true;
      }
      const levelChanged = levelWhenDone != null && level != null && level !== levelWhenDone;
      if (!levelChanged && levelWhenDone != null) return false;

      const targetLevel = level != null ? level : levelWhenDone != null ? levelWhenDone + 1 : null;
      console.log('JOBBO: Level changed to ' + targetLevel + ', waiting for new board...');

      // Wait until we see a grid that is *different* from the completed level (new board has rendered),
      // then require it to stay stable for BOARD_STABLE_MS so we don't run on stale DOM.
      let gridKey = null;
      let gridStableSince = 0;
      let pollId = null;
      let maxId = null;
      const oldKey = gridKeyWhenDone || '';

      function stopPolling() {
        if (pollId) clearTimeout(pollId);
        if (maxId) clearTimeout(maxId);
      }

      function checkStable() {
        const g = discoverGrid();
        const currentLevel = getCurrentLevel();
        if (currentLevel !== targetLevel || !g) {
          gridKey = null;
          return false;
        }
        const key = g.cols + ',' + g.rows + ',' + g.playerIndex + ',' + g.appleIndex;
        // Must see the *new* level's board (different from completed level), not the old one
        if (oldKey && key === oldKey) {
          gridKey = null;
          return false;
        }
        const now = Date.now();
        if (key !== gridKey) {
          gridKey = key;
          gridStableSince = now;
          return false;
        }
        if (now - gridStableSince >= BOARD_STABLE_MS) {
          console.log('JOBBO: New board stable, resuming for level ' + targetLevel + '.');
          stopPolling();
          runNow();
          return true;
        }
        return false;
      }

      function pollBoard() {
        if (checkStable()) return;
        pollId = setTimeout(pollBoard, BOARD_POLL_MS);
      }

      maxId = setTimeout(() => {
        stopPolling();
        console.log('JOBBO: Board stable timeout, resuming anyway.');
        runNow();
      }, BOARD_STABLE_MAX_MS);

      setTimeout(pollBoard, 12);
      return true;
    }

    let elapsed = 0;
    function tick() {
      if (tryResume()) return;
      elapsed += POLL_MS;
      if (elapsed < MAX_WAIT_MS) setTimeout(tick, POLL_MS);
      else {
        console.log('JOBBO: Level did not change after ' + (MAX_WAIT_MS / 1000) + 's, resuming anyway.');
        setTimeout(runNow, 25);
      }
    }
    setTimeout(() => { if (!tryResume()) tick(); }, RESUME_DELAY_MS);
  }

  /**
   * Run continuously: after each step, when our move sequence is done we wait then run again. Stops at level 1000.
   */
  function runLoop(delayMs = 10, levelCheckIntervalMs = 500) {
    const level = getCurrentLevel();
    if (level != null && level >= 1000) {
      console.log('JOBBO: Already at level 1000. Stopping.');
      return;
    }
    const levelBeforeStep = getCurrentLevel();
    function doStep() {
      const g = discoverGrid();
      if (g) {
        runStep(delayMs, () => {
          const gDone = discoverGrid();
          const gridKeyWhenDone = gDone ? (gDone.cols + ',' + gDone.rows + ',' + gDone.playerIndex + ',' + gDone.appleIndex) : '';
          waitForLevelReadyThenRun(delayMs, levelCheckIntervalMs, levelBeforeStep, gridKeyWhenDone);
        });
        return true;
      }
      return false;
    }
    if (!doStep()) {
      const retry = setInterval(() => {
        if (doStep()) clearInterval(retry);
      }, 200);
      setTimeout(() => clearInterval(retry), 5000);
    }
  }

  window.JOBBO = {
    runStep,
    runLoop,
    discoverGrid,
    dispatchKey,
  };

  console.log('JOBBO automation loaded. Usage: JOBBO.runStep() or JOBBO.runLoop(). If the character does not move, click the game board once then run again.');
})();
