import test from "node:test";
import assert from "node:assert/strict";
import {
  COMMANDS,
  countProgramBlocks,
  createGameState,
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