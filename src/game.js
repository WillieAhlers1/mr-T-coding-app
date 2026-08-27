export const COMMANDS = Object.freeze({
  FORWARD: "forward",
  LEFT: "left",
  RIGHT: "right",
});

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
  return commands.reduce((state, command) => runCommand(level, state, command), createGameState(level));
}