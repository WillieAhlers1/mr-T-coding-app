import { COMMANDS, createGameState, runCommand } from "./game.js";
import { LEVELS } from "./levels.js";
import { SoundEffects } from "./audio.js";

const TILE_SIZE = 64;
const STEP_DELAY = 420;
const COMMAND_SYMBOLS = {
  [COMMANDS.FORWARD]: "GO",
  [COMMANDS.LEFT]: "L",
  [COMMANDS.RIGHT]: "R",
};

const elements = {
  board: document.querySelector("#game-board"),
  boardMessage: document.querySelector("#board-message"),
  levelNumber: document.querySelector("#level-number"),
  levelName: document.querySelector("#level-name"),
  levelHint: document.querySelector("#level-hint"),
  crystalCount: document.querySelector("#crystal-count"),
  budget: document.querySelector("#command-budget"),
  programList: document.querySelector("#program-list"),
  runButton: document.querySelector("#run-button"),
  undoButton: document.querySelector("#undo-button"),
  clearButton: document.querySelector("#clear-button"),
  soundToggle: document.querySelector("#sound-toggle"),
  soundLabel: document.querySelector("#sound-label"),
  levelButtons: document.querySelector("#level-buttons"),
  winDialog: document.querySelector("#win-dialog"),
  winTitle: document.querySelector("#win-title"),
  winMessage: document.querySelector("#win-message"),
  nextButton: document.querySelector("#next-button"),
};

const context = elements.board.getContext("2d");
const sounds = new SoundEffects();
const savedProgress = Number.parseInt(localStorage.getItem("turtleQuestLevel") || "0", 10);
let unlockedLevel = Number.isFinite(savedProgress) ? Math.min(savedProgress, LEVELS.length - 1) : 0;
let currentLevelIndex = 0;
let state = createGameState(LEVELS[0]);
let program = [];
let running = false;

function color(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function drawBlock(x, y, size) {
  context.fillStyle = color("--cp-dirt");
  context.fillRect(x, y, size, size);
  context.fillStyle = color("--cp-grass");
  context.fillRect(x, y, size, Math.ceil(size * 0.28));
  context.fillStyle = color("--cp-grass-light");
  context.fillRect(x, y, size, Math.ceil(size * 0.08));
  context.fillStyle = color("--cp-dirt-dark");
  context.fillRect(x + size * 0.12, y + size * 0.55, size * 0.16, size * 0.12);
  context.fillRect(x + size * 0.66, y + size * 0.72, size * 0.2, size * 0.12);
  context.strokeStyle = color("--cp-grid");
  context.lineWidth = 2;
  context.strokeRect(x, y, size, size);
}

function drawRock(x, y, size) {
  const pad = size * 0.16;
  context.fillStyle = color("--cp-rock");
  context.fillRect(x + pad, y + pad, size - pad * 2, size - pad * 1.45);
  context.fillStyle = color("--cp-rock-light");
  context.fillRect(x + pad, y + pad, size * 0.4, size * 0.18);
  context.fillRect(x + size * 0.58, y + size * 0.45, size * 0.18, size * 0.16);
  context.strokeStyle = color("--cp-ink");
  context.lineWidth = 3;
  context.strokeRect(x + pad, y + pad, size - pad * 2, size - pad * 1.45);
}

function drawCrystal(x, y, size) {
  const centerX = x + size / 2;
  context.beginPath();
  context.moveTo(x + size * 0.38, y + size * 0.26);
  context.lineTo(x + size * 0.62, y + size * 0.26);
  context.lineTo(x + size * 0.72, y + size * 0.39);
  context.lineTo(x + size * 0.62, y + size * 0.7);
  context.lineTo(centerX, y + size * 0.78);
  context.lineTo(x + size * 0.38, y + size * 0.7);
  context.lineTo(x + size * 0.28, y + size * 0.39);
  context.closePath();
  context.fillStyle = color("--cp-crystal");
  context.fill();
  context.strokeStyle = color("--cp-ink");
  context.lineWidth = 3;
  context.stroke();
  context.fillStyle = color("--cp-crystal-light");
  context.fillRect(x + size * 0.39, y + size * 0.35, size * 0.08, size * 0.22);
}

function drawTurtle(x, y, size, direction) {
  context.save();
  context.translate(x + size / 2, y + size / 2);
  const rotations = { north: 0, east: Math.PI / 2, south: Math.PI, west: -Math.PI / 2 };
  context.rotate(rotations[direction]);
  context.translate(-size / 2, -size / 2);
  context.fillStyle = color("--cp-turtle");
  context.fillRect(size * 0.28, size * 0.3, size * 0.44, size * 0.44);
  context.fillStyle = color("--cp-turtle-light");
  context.fillRect(size * 0.38, size * 0.4, size * 0.24, size * 0.24);
  context.fillStyle = color("--cp-turtle");
  context.fillRect(size * 0.38, size * 0.12, size * 0.24, size * 0.2);
  context.fillRect(size * 0.16, size * 0.28, size * 0.16, size * 0.16);
  context.fillRect(size * 0.68, size * 0.28, size * 0.16, size * 0.16);
  context.fillRect(size * 0.16, size * 0.64, size * 0.16, size * 0.16);
  context.fillRect(size * 0.68, size * 0.64, size * 0.16, size * 0.16);
  context.fillStyle = color("--cp-ink");
  context.fillRect(size * 0.43, size * 0.16, size * 0.05, size * 0.05);
  context.fillRect(size * 0.54, size * 0.16, size * 0.05, size * 0.05);
  context.restore();
}

function drawBoard() {
  const level = LEVELS[currentLevelIndex];
  elements.board.width = level.width * TILE_SIZE;
  elements.board.height = level.height * TILE_SIZE;
  context.imageSmoothingEnabled = false;

  for (let y = 0; y < level.height; y += 1) {
    for (let x = 0; x < level.width; x += 1) {
      drawBlock(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE);
    }
  }

  level.rocks.forEach((cell) => {
    const [x, y] = cell.split(",").map(Number);
    drawRock(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE);
  });
  level.crystals.filter((cell) => !state.collected.includes(cell)).forEach((cell) => {
    const [x, y] = cell.split(",").map(Number);
    drawCrystal(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE);
  });
  drawTurtle(state.x * TILE_SIZE, state.y * TILE_SIZE, TILE_SIZE, state.direction);
}

function renderProgram(activeIndex = -1) {
  elements.programList.replaceChildren(...program.map((command, index) => {
    const item = document.createElement("li");
    item.className = `program-step${command === COMMANDS.FORWARD ? "" : " turn"}${index === activeIndex ? " active" : ""}`;
    item.textContent = COMMAND_SYMBOLS[command];
    item.setAttribute("aria-label", `Step ${index + 1}: ${command}`);
    return item;
  }));
}

function renderControls() {
  const level = LEVELS[currentLevelIndex];
  const atLimit = program.length >= level.maxCommands;
  elements.budget.textContent = `${program.length} / ${level.maxCommands}`;
  elements.undoButton.disabled = running || program.length === 0;
  elements.clearButton.disabled = running || program.length === 0;
  elements.runButton.disabled = running || program.length === 0;
  document.querySelectorAll("[data-command]").forEach((button) => {
    button.disabled = running || atLimit;
  });
}

function renderLevelButtons() {
  elements.levelButtons.replaceChildren(...LEVELS.map((level, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `level-button${index === currentLevelIndex ? " current" : ""}${index < unlockedLevel ? " complete" : ""}`;
    button.textContent = index + 1;
    button.disabled = index > unlockedLevel;
    button.title = index > unlockedLevel ? "Locked level" : level.name;
    button.setAttribute("aria-label", `Level ${index + 1}: ${level.name}`);
    button.addEventListener("click", () => loadLevel(index));
    return button;
  }));
}

function renderAll() {
  const level = LEVELS[currentLevelIndex];
  elements.levelNumber.textContent = `LEVEL ${currentLevelIndex + 1}`;
  elements.levelName.textContent = level.name;
  elements.levelHint.textContent = level.hint;
  elements.crystalCount.textContent = `${state.collected.length} / ${level.crystals.length}`;
  renderProgram();
  renderControls();
  renderLevelButtons();
  drawBoard();
}

function loadLevel(index) {
  if (running || index > unlockedLevel) return;
  currentLevelIndex = index;
  state = createGameState(LEVELS[index]);
  program = [];
  elements.boardMessage.textContent = "BUILD YOUR CODE!";
  renderAll();
}

function addCommand(command) {
  if (running || program.length >= LEVELS[currentLevelIndex].maxCommands) return;
  program.push(command);
  sounds.turn();
  elements.boardMessage.textContent = program.length === LEVELS[currentLevelIndex].maxCommands
    ? "CODE FULL - PRESS RUN!"
    : "KEEP BUILDING!";
  renderProgram();
  renderControls();
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function runProgram() {
  if (running || program.length === 0) return;
  running = true;
  state = createGameState(LEVELS[currentLevelIndex]);
  elements.boardMessage.textContent = "RUNNING...";
  renderControls();
  drawBoard();

  for (let index = 0; index < program.length; index += 1) {
    const command = program[index];
    const crystalsBefore = state.collected.length;
    renderProgram(index);
    await sleep(STEP_DELAY);
    state = runCommand(LEVELS[currentLevelIndex], state, command);
    drawBoard();
    elements.crystalCount.textContent = `${state.collected.length} / ${LEVELS[currentLevelIndex].crystals.length}`;

    if (state.status === "blocked") {
      sounds.bump();
      elements.boardMessage.textContent = "BONK! TRY A TURN.";
    } else if (state.collected.length > crystalsBefore) {
      sounds.crystal();
      elements.boardMessage.textContent = "CRYSTAL FOUND!";
    } else if (command === COMMANDS.FORWARD) {
      sounds.step();
    } else {
      sounds.turn();
    }

    if (state.status === "complete") break;
  }

  running = false;
  renderProgram();
  renderControls();

  if (state.status === "complete") {
    completeLevel();
  } else if (state.status !== "blocked") {
    elements.boardMessage.textContent = "NOT YET - CHANGE YOUR CODE!";
  }
}

function completeLevel() {
  sounds.win();
  const lastLevel = currentLevelIndex === LEVELS.length - 1;
  if (!lastLevel) {
    unlockedLevel = Math.max(unlockedLevel, currentLevelIndex + 1);
    localStorage.setItem("turtleQuestLevel", String(unlockedLevel));
  }
  renderLevelButtons();
  elements.winTitle.textContent = lastLevel ? "Master coder!" : "Crystal found!";
  elements.winMessage.textContent = lastLevel ? "You completed every Turtle Quest." : `Level ${currentLevelIndex + 1} cleared in ${state.moves} commands.`;
  elements.nextButton.textContent = lastLevel ? "PLAY AGAIN" : "NEXT LEVEL \u2192";
  elements.winDialog.showModal();
}

document.querySelectorAll("[data-command]").forEach((button) => {
  button.addEventListener("click", () => addCommand(button.dataset.command));
});

elements.undoButton.addEventListener("click", () => {
  program.pop();
  elements.boardMessage.textContent = program.length ? "CODE CHANGED!" : "BUILD YOUR CODE!";
  renderProgram();
  renderControls();
});

elements.clearButton.addEventListener("click", () => {
  program = [];
  state = createGameState(LEVELS[currentLevelIndex]);
  elements.boardMessage.textContent = "BUILD YOUR CODE!";
  renderAll();
});

elements.runButton.addEventListener("click", runProgram);
elements.soundToggle.addEventListener("click", () => {
  const enabled = sounds.toggle();
  elements.soundLabel.textContent = enabled ? "ON" : "OFF";
  elements.soundToggle.setAttribute("aria-pressed", String(!enabled));
  elements.soundToggle.title = enabled ? "Turn sound off" : "Turn sound on";
});
elements.nextButton.addEventListener("click", () => {
  elements.winDialog.close();
  loadLevel(currentLevelIndex === LEVELS.length - 1 ? 0 : currentLevelIndex + 1);
});

window.addEventListener("keydown", (event) => {
  if (event.key === "ArrowUp") addCommand(COMMANDS.FORWARD);
  if (event.key === "ArrowLeft") addCommand(COMMANDS.LEFT);
  if (event.key === "ArrowRight") addCommand(COMMANDS.RIGHT);
  if (event.key === "Enter") runProgram();
});

window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", drawBoard);
renderAll();