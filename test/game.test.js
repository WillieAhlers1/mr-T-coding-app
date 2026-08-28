import test from "node:test";
import assert from "node:assert/strict";
import {
  COMMANDS,
  PREDICATES,
  countProgramBlocks,
  createGameState,
  createIf,
  createProgramSteps,
  createRepeat,
  runCommand,
  runProgram,
} from "../src/game.js";

const level = {
  width: 4,
  height: 3,
  start: { x: 0, y: 1, direction: "east" },
  rocks: ["1,0"],
  pits: ["3,1"],
  crystals: ["2,1"],
};

test("moves forward in the turtle's current direction", () => {
  const state = runCommand(level, createGameState(level), COMMANDS.FORWARD);

  assert.deepEqual({ x: state.x, y: state.y, direction: state.direction }, { x: 1, y: 1, direction: "east" });
});

test("turns left and right without changing position", () => {
  const left = runCommand(level, createGameState(level), COMMANDS.LEFT);
  const right = runCommand(level, createGameState(level), COMMANDS.RIGHT);

  assert.equal(left.direction, "north");
  assert.equal(right.direction, "south");
  assert.deepEqual([left.x, left.y], [0, 1]);
});

test("stays put and reports blocked when facing a rock", () => {
  const facingRock = { ...createGameState(level), x: 1, y: 1, direction: "north" };
  const state = runCommand(level, facingRock, COMMANDS.FORWARD);

  assert.deepEqual([state.x, state.y], [1, 1]);
  assert.equal(state.status, "blocked");
  assert.equal(state.reason, "wall");
});

test("distinguishes the board edge from a wall", () => {
  const facingEdge = { ...createGameState(level), direction: "west" };
  const state = runCommand(level, facingEdge, COMMANDS.FORWARD);

  assert.deepEqual([state.x, state.y], [0, 1]);
  assert.equal(state.status, "blocked");
  assert.equal(state.reason, "edge");
});

test("entering a pit ends the attempt", () => {
  const besidePit = { ...createGameState(level), x: 2, y: 1 };
  const state = runCommand(level, besidePit, COMMANDS.FORWARD);

  assert.deepEqual([state.x, state.y], [3, 1]);
  assert.equal(state.status, "failed");
  assert.equal(state.reason, "pit");
});

test("collects a key and opens a door when entering it", () => {
  const doorLevel = {
    width: 4,
    height: 1,
    start: { x: 0, y: 0, direction: "east" },
    rocks: [],
    pits: [],
    keys: ["1,0"],
    doors: ["2,0"],
    pushables: [],
    crystals: ["3,0"],
  };
  const state = runProgram(doorLevel, [COMMANDS.FORWARD, COMMANDS.FORWARD, COMMANDS.FORWARD]);

  assert.deepEqual(state.collectedKeys, ["1,0"]);
  assert.deepEqual(state.openedDoors, ["2,0"]);
  assert.equal(state.status, "complete");
});

test("a locked door blocks movement with a distinct reason", () => {
  const doorLevel = {
    ...level,
    keys: ["0,0"],
    doors: ["1,1"],
  };
  const state = runCommand(doorLevel, createGameState(doorLevel), COMMANDS.FORWARD);

  assert.deepEqual([state.x, state.y], [0, 1]);
  assert.equal(state.status, "blocked");
  assert.equal(state.reason, "locked-door");
});

test("pushes a block into a free cell", () => {
  const pushLevel = {
    ...level,
    rocks: [],
    pits: [],
    pushables: ["1,1"],
    crystals: ["3,1"],
  };
  const state = runCommand(pushLevel, createGameState(pushLevel), COMMANDS.FORWARD);

  assert.deepEqual([state.x, state.y], [1, 1]);
  assert.deepEqual(state.pushables, ["2,1"]);
  assert.equal(state.status, "running");
});

test("cannot push a block into an occupied cell", () => {
  const pushLevel = {
    ...level,
    rocks: ["2,1"],
    pushables: ["1,1"],
  };
  const state = runCommand(pushLevel, createGameState(pushLevel), COMMANDS.FORWARD);

  assert.deepEqual([state.x, state.y], [0, 1]);
  assert.deepEqual(state.pushables, ["1,1"]);
  assert.equal(state.status, "blocked");
  assert.equal(state.reason, "immovable-block");
});

test("collects the crystal and completes the level", () => {
  const state = runProgram(level, [COMMANDS.FORWARD, COMMANDS.FORWARD]);

  assert.deepEqual(state.collected, ["2,1"]);
  assert.equal(state.status, "complete");
});

test("rejects unknown commands", () => {
  assert.throws(() => runCommand(level, createGameState(level), "jump"), /Unknown command/);
});

test("repeats a command body and counts its authored blocks once", () => {
  const program = [createRepeat(2, [COMMANDS.FORWARD])];
  const state = runProgram(level, program);

  assert.equal(state.status, "complete");
  assert.equal(state.moves, 2);
  assert.equal(countProgramBlocks(program), 2);
});

test("expands repeats into executable steps with source paths", () => {
  const program = [COMMANDS.RIGHT, createRepeat(2, [COMMANDS.FORWARD])];

  assert.deepEqual(createProgramSteps(program), [
    { command: COMMANDS.RIGHT, sourcePath: [0] },
    { command: COMMANDS.FORWARD, sourcePath: [1, 0] },
    { command: COMMANDS.FORWARD, sourcePath: [1, 0] },
  ]);
});

test("supports turns and nested repeats", () => {
  const openLevel = {
    ...level,
    width: 5,
    height: 5,
    start: { x: 2, y: 2, direction: "north" },
    crystals: ["0,0"],
  };
  const turnAndMove = createRepeat(2, [COMMANDS.RIGHT, createRepeat(2, [COMMANDS.FORWARD])]);
  const state = runProgram(openLevel, [turnAndMove]);

  assert.deepEqual([state.x, state.y, state.direction], [4, 4, "south"]);
  assert.equal(countProgramBlocks([turnAndMove]), 4);
});

test("allows an empty repeat body without changing state", () => {
  const initialState = createGameState(level);

  assert.deepEqual(runProgram(level, [createRepeat(3, [])]), initialState);
});

test("rejects malformed repeat blocks", () => {
  assert.throws(() => createRepeat(1, [COMMANDS.FORWARD]), /between 2 and 5/);
  assert.throws(() => createRepeat(6, [COMMANDS.FORWARD]), /between 2 and 5/);
  assert.throws(() => createRepeat(3, "forward"), /body must be an array/);
  assert.throws(
    () => runProgram(level, [{ type: "repeat", count: 3, body: "forward" }]),
    /body must be an array/,
  );
});

test("executes an IF body only when the path ahead is open", () => {
  const openLevel = {
    ...level,
    rocks: [],
    pits: [],
    crystals: ["1,1"],
  };
  const program = [createIf(PREDICATES.PATH_AHEAD, [COMMANDS.FORWARD])];

  assert.equal(runProgram(openLevel, program).status, "complete");

  const blockedLevel = { ...openLevel, rocks: ["1,1"], crystals: ["2,1"] };
  const blockedState = runProgram(blockedLevel, program);
  assert.deepEqual([blockedState.x, blockedState.y], [0, 1]);
  assert.equal(blockedState.moves, 0);
});

test("evaluates has-key after earlier commands collect a key", () => {
  const keyLevel = {
    width: 3,
    height: 1,
    start: { x: 0, y: 0, direction: "east" },
    rocks: [],
    keys: ["1,0"],
    crystals: ["2,0"],
  };
  const program = [
    COMMANDS.FORWARD,
    createIf(PREDICATES.HAS_KEY, [COMMANDS.FORWARD]),
  ];
  const state = runProgram(keyLevel, program);

  assert.equal(state.status, "complete");
  assert.equal(countProgramBlocks(program), 3);
});

test("rejects malformed IF blocks", () => {
  assert.throws(() => createIf("crystal-nearby", [COMMANDS.FORWARD]), /Unknown predicate/);
  assert.throws(() => createIf(PREDICATES.PATH_AHEAD, "forward"), /body must be an array/);
});