import test from "node:test";
import assert from "node:assert/strict";
import { runProgram } from "../src/game.js";
import { LEVELS } from "../src/levels.js";

test("every level solution collects every crystal within its command limit", async (context) => {
  for (const level of LEVELS) {
    await context.test(level.name, () => {
      const result = runProgram(level, level.solution);

      assert.equal(result.status, "complete");
      assert.equal(result.collected.length, level.crystals.length);
      assert.ok(level.solution.length <= level.maxCommands);
    });
  }
});