export const COMMANDS = Object.freeze({
  FORWARD: "forward",
  LEFT: "left",
  RIGHT: "right",
});

export const PROGRAM_TYPES = Object.freeze({
  REPEAT: "repeat",
});

const MIN_REPEAT_COUNT = 2;
const MAX_REPEAT_COUNT = 5;

export const DIRECTIONS = Object.freeze(["north", "east", "south", "west"]);

export function createGameState(level) {
  return {
    x: level.start.x,
    y: level.start.y,
    direction: level.start.direction,
    collected: [],
    moves: 0,
    status: "ready",
  };
}

function validateRepeat(count, body) {
  if (!Number.isInteger(count) || count < MIN_REPEAT_COUNT || count > MAX_REPEAT_COUNT) {
    throw new Error(`Repeat count must be between ${MIN_REPEAT_COUNT} and ${MAX_REPEAT_COUNT}`);
  }

  if (!Array.isArray(body)) {
    throw new Error("Repeat body must be an array");
  }
}

export function createRepeat(count, body) {
  validateRepeat(count, body);
  return { type: PROGRAM_TYPES.REPEAT, count, body: [...body] };
}

export function countProgramBlocks(program) {
  return program.reduce((total, block) => {
    if (typeof block === "string") return total + 1;
    if (block?.type !== PROGRAM_TYPES.REPEAT) {
      throw new Error(`Unknown program block: ${block?.type ?? block}`);
    }

    validateRepeat(block.count, block.body);
    return total + 1 + countProgramBlocks(block.body);
  }, 0);
}

export function createProgramSteps(program) {
  const steps = [];

  function appendBlocks(blocks, parentPath = []) {
    blocks.forEach((block, index) => {
      const sourcePath = [...parentPath, index];
      if (typeof block === "string") {
        steps.push({ command: block, sourcePath });
        return;
      }

      if (block?.type !== PROGRAM_TYPES.REPEAT) {
        throw new Error(`Unknown program block: ${block?.type ?? block}`);
      }

      validateRepeat(block.count, block.body);
      for (let iteration = 0; iteration < block.count; iteration += 1) {
        appendBlocks(block.body, sourcePath);
      }
    });
  }

  appendBlocks(program);
  return steps;
}

export function runCommand(level, state, command) {
  if (state.status === "complete") {
    return state;
  }

  if (command === COMMANDS.LEFT || command === COMMANDS.RIGHT) {
    const turn = command === COMMANDS.RIGHT ? 1 : -1;
    const currentIndex = DIRECTIONS.indexOf(state.direction);
    return {
      ...state,
      direction: DIRECTIONS[(currentIndex + turn + DIRECTIONS.length) % DIRECTIONS.length],
      moves: state.moves + 1,
      status: "running",
    };
  }

  if (command !== COMMANDS.FORWARD) {
    throw new Error(`Unknown command: ${command}`);
  }

  const offsets = {
    north: { x: 0, y: -1 },
    east: { x: 1, y: 0 },
    south: { x: 0, y: 1 },
    west: { x: -1, y: 0 },
  };
  const nextX = state.x + offsets[state.direction].x;
  const nextY = state.y + offsets[state.direction].y;
  const cell = `${nextX},${nextY}`;
  const outsideBoard = nextX < 0 || nextY < 0 || nextX >= level.width || nextY >= level.height;

  if (outsideBoard || level.rocks.includes(cell)) {
    return { ...state, moves: state.moves + 1, status: "blocked" };
  }

  const collected = level.crystals.includes(cell) && !state.collected.includes(cell)
    ? [...state.collected, cell]
    : state.collected;
  const complete = collected.length === level.crystals.length;

  return {
    ...state,
    x: nextX,
    y: nextY,
    collected,
    moves: state.moves + 1,
    status: complete ? "complete" : "running",
  };
}

export function runProgram(level, commands) {
  return createProgramSteps(commands).reduce(
    (state, step) => runCommand(level, state, step.command),
    createGameState(level),
  );
}