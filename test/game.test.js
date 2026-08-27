import test from "node:test";
import assert from "node:assert/strict";
import { COMMANDS, createGameState, runCommand, runProgram } from "../src/game.js";

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