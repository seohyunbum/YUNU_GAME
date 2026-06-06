import assert from "node:assert/strict";
import { createServer } from "vite";

const server = await createServer({
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});

try {
  const { calculateCombatDamage } = await server.ssrLoadModule("/src/game/combat.ts");

  const cases = [
    { attack: 8, defense: 0, expected: 8, label: "unarmored target takes base damage" },
    { attack: 8, defense: 10, expected: 7, label: "small armor advantage reduces damage" },
    { attack: 8, defense: 19, expected: 3, label: "large armor advantage still allows chip damage" },
    { attack: 8, defense: 28, expected: 0, label: "armor gap of 20 fully blocks damage" },
    { attack: 40, defense: 50, expected: 20, label: "dragon-grade armor halves a weaker hit" },
    { attack: 80, defense: 25, expected: 85, label: "big attack advantage adds bonus damage" },
    { attack: 8.9, defense: 1.2, expected: 8, label: "fractional inputs are floored" },
    { attack: -5, defense: 0, expected: 1, label: "current legacy behavior preserves minimum nonblocked damage" },
    { attack: 0, defense: 100, expected: 0, label: "very high armor blocks zero attack" },
  ];

  for (const testCase of cases) {
    assert.equal(
      calculateCombatDamage(testCase.attack, testCase.defense),
      testCase.expected,
      testCase.label,
    );
  }

  console.log(JSON.stringify({
    ok: true,
    checks: cases.map((testCase) => testCase.label),
  }, null, 2));
} finally {
  await server.close();
}
