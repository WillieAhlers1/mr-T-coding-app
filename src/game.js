export const COMMANDS = Object.freeze({
  FORWARD: "forward",
  LEFT: "left",
  RIGHT: "right",
});

export const PROGRAM_TYPES = Object.freeze({
  REPEAT: "repeat",
  IF: "if",
});

export const PREDICATES = Object.freeze({
  PATH_AHEAD: "path-ahead",
  HAS_KEY: "has-key",
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
       collectedKeys: [],
       openedDoors: [],
       pushables: [...(level.pushables ?? [])],
    moves: 0,
    status: "ready",
    reason: null,
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

function validateIf(predicate, body) {
  if (!Object.values(PREDICATES).includes(predicate)) {
    throw new Error(`Unknown predicate: ${predicate}`);
  }

  if (!Array.isArray(body)) {
    throw new Error("IF body must be an array");
  }
}

export function createIf(predicate, body) {
  validateIf(predicate, body);
  return { type: PROGRAM_TYPES.IF, predicate, body: [...body] };
}

export function countProgramBlocks(program) {
  return program.reduce((total, block) => {
    if (typeof block === "string") return total + 1;
    if (block?.type === PROGRAM_TYPES.IF) {
      validateIf(block.predicate, block.body);
      return total + 1 + countProgramBlocks(block.body);
    }

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

      if (block?.type === PROGRAM_TYPES.IF) {
        validateIf(block.predicate, block.body);
        steps.push({ predicate: block.predicate, body: [...block.body], sourcePath });
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
  if (state.status === "complete" || state.status === "failed") {
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
      reason: null,
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

  if (outsideBoard) {
    return { ...state, moves: state.moves + 1, status: "blocked", reason: "edge" };
  }

  if (level.rocks.includes(cell)) {
    return { ...state, moves: state.moves + 1, status: "blocked", reason: "wall" };
  }

     const doorIsLocked = level.doors?.includes(cell) && state.collectedKeys.length === 0;
     if (doorIsLocked) {
       return { ...state, moves: state.moves + 1, status: "blocked", reason: "locked-door" };
     }

     let pushables = state.pushables;
     if (pushables.includes(cell)) {
       const pushedX = nextX + offsets[state.direction].x;
       const pushedY = nextY + offsets[state.direction].y;
       const pushedCell = `${pushedX},${pushedY}`;
       const pushIsBlocked = pushedX < 0
         || pushedY < 0
         || pushedX >= level.width
         || pushedY >= level.height
         || level.rocks.includes(pushedCell)
         || level.pits?.includes(pushedCell)
         || level.doors?.includes(pushedCell)
         || pushables.includes(pushedCell);

       if (pushIsBlocked) {
         return { ...state, moves: state.moves + 1, status: "blocked", reason: "immovable-block" };
       }

       pushables = pushables.map((position) => position === cell ? pushedCell : position);
     }

  if (level.pits?.includes(cell)) {
    return {
      ...state,
      x: nextX,
      y: nextY,
      moves: state.moves + 1,
      status: "failed",
      reason: "pit",
    };
  }

     const collectedKeys = level.keys?.includes(cell) && !state.collectedKeys.includes(cell)
       ? [...state.collectedKeys, cell]
       : state.collectedKeys;
     const openedDoors = level.doors?.includes(cell) && !state.openedDoors.includes(cell)
       ? [...state.openedDoors, cell]
       : state.openedDoors;
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
    collectedKeys,
    openedDoors,
    pushables,
    status: complete ? "complete" : "running",
    reason: null,
  };
}

export function evaluatePredicate(level, state, predicate) {
  if (predicate === PREDICATES.HAS_KEY) {
    return state.collectedKeys.length > 0;
  }

  if (predicate === PREDICATES.PATH_AHEAD) {
    const nextState = runCommand(level, state, COMMANDS.FORWARD);
    return nextState.status !== "blocked" && nextState.status !== "failed";
  }

  throw new Error(`Unknown predicate: ${predicate}`);
}

export function createExecutionTrace(level, program) {
  let state = createGameState(level);
  const steps = [];

  function executeBlocks(blocks, parentPath = []) {
    for (let index = 0; index < blocks.length; index += 1) {
      const block = blocks[index];
      const sourcePath = [...parentPath, index];

      if (typeof block === "string") {
        state = runCommand(level, state, block);
        steps.push({ command: block, sourcePath, state });
      } else if (block?.type === PROGRAM_TYPES.REPEAT) {
        validateRepeat(block.count, block.body);
        for (let iteration = 0; iteration < block.count; iteration += 1) {
          executeBlocks(block.body, sourcePath);
          if (["blocked", "complete", "failed"].includes(state.status)) break;
        }
      } else if (block?.type === PROGRAM_TYPES.IF) {
        validateIf(block.predicate, block.body);
        const passed = evaluatePredicate(level, state, block.predicate);
        steps.push({ predicate: block.predicate, passed, sourcePath, state });
        if (passed) executeBlocks(block.body, sourcePath);
      } else {
        throw new Error(`Unknown program block: ${block?.type ?? block}`);
      }

      if (["blocked", "complete", "failed"].includes(state.status)) break;
    }
  }

  executeBlocks(program);
  return { state, steps };
}

export function runProgram(level, commands) {
  return createExecutionTrace(level, commands).state;
}