# JOBBO Game Automation

Makes the player move to the apple automatically by reading the game from the page and sending arrow keys.

## Quick start (Chrome tab)

1. Open the game at **https://jobbo.n1.xyz** in Chrome and get to the actual game board (after verification).
2. Close the instructions modal if it’s open (so the board is visible).
3. Press **F12** to open DevTools and go to the **Console** tab.
4. Copy the entire contents of `jobbo-automation.js` and paste into the console, then press **Enter**.
5. Run:
   - **One level:**  
     `JOBBO.runStep()`  
     Moves the player to the apple once.
   - **Keep playing levels:**  
     `JOBBO.runLoop()`  
     Solves the current level, then keeps solving new levels (with a short delay between levels).

## Options

- **Slower moves (e.g. 120 ms between keys):**  
  `JOBBO.runStep(120)` or `JOBBO.runLoop(120)`
- **Inspect what was found:**  
  `JOBBO.discoverGrid()`  
  Returns the detected grid info or `null` if nothing was found.
- **Send a single key (for testing):**  
  `JOBBO.dispatchKey('up')` or `'down'`, `'left'`, `'right'`

## If it doesn’t find the grid

The script tries several ways to find the board and player/apple. If it still can’t:

1. Make sure the **game board is visible** (instructions modal closed).
2. Run `JOBBO.discoverGrid()` in the console and check the console for errors.
3. In DevTools **Elements** tab, find the game board and the elements for the player and apple, and note any `data-*` attributes or class names (e.g. `data-cell`, `data-player`, `.player`, `.apple`). With that structure, the script can be adjusted to use those selectors.

## Files

- **jobbo-automation.js** – Script to paste into the browser console on the game page.
