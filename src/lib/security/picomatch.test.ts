import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const tailwindRequire = createRequire(require.resolve("tailwindcss/package.json"));
const micromatchRequire = createRequire(tailwindRequire.resolve("micromatch/package.json"));
const vitestRequire = createRequire(require.resolve("vitest/package.json"));

type Picomatch = {
  makeRe: (pattern: string, options?: Record<string, unknown>) => RegExp;
  isMatch: (value: string, pattern: string, options?: Record<string, unknown>) => boolean;
};

// Exercise the installed dependency paths, so removing either pnpm patch fails
// the regression checks. See GHSA-fc5q-39xc-vjpf and picomatch PRs #237 / #246.
describe.each([
  { name: "Tailwind / micromatch (picomatch 2)", path: micromatchRequire.resolve("picomatch") },
  { name: "Vitest (picomatch 4)", path: vitestRequire.resolve("picomatch") },
])("picomatch security patch: $name", ({ path }) => {
  const picomatch = require(path) as Picomatch;

  it("finishes adversarial repeated-star matches without exponential backtracking", () => {
    // A child-process deadline keeps a missing/regressed patch from hanging the
    // test runner. The unpatched expressions cannot finish this input in time.
    expect(() => execFileSync(process.execPath, ["-e", `
      const assert = require('node:assert/strict');
      const picomatch = require(${JSON.stringify(path)});
      const patterns = [
        '+(*a)', '*(*a)', '+(*)z', '+(*a)z', 'x+(*a)',
        '+(*[ab])', '*(*[ab])', '+(a?*)z', '+(*?)z', '+(**)z', '+(*[)z'
      ];
      for (const pattern of patterns) {
        for (const options of [{}, { capture: true }]) {
          const input = (pattern.startsWith('x') ? 'x' : '') + 'a'.repeat(50) + 'c';
          assert.equal(picomatch.isMatch(input, pattern, options), false, pattern);
        }
      }
    `], { timeout: 2000, stdio: "pipe" })).not.toThrow();
  });

  it("preserves ordinary globs and simple repeated-star matching", () => {
    const patterns = [
      "src/**/*.{ts,tsx}", "**/*.test.ts", "*.js", "@(foo|bar).js", "+(ab)",
      "+(*)", "+(*a)", "*(*a)", "+(a*)", "+(a*b)", "*(*.js)", "x+(*a)y", "+(*)c",
    ];
    const inputs = [
      "", "a", "aa", "ab", "abab", "a.a", ".a", "a/b", "abc", "axbayb", "foo.js",
      "bar.js", "foo.ts", "xaay", "src/app/page.tsx", "src/lib/example.test.ts",
    ];

    for (const options of [{}, { dot: true }, { windows: true }, { bash: true }, { contains: true }]) {
      for (const pattern of patterns) {
        for (const input of inputs) {
          expect(picomatch.isMatch(input, pattern, options), JSON.stringify({ pattern, input, options }))
            .toBe(picomatch.isMatch(input, pattern, { ...options, maxExtglobRecursion: false }));
        }
      }
    }
  });

  it("uses the existing literal fallback for complex branches and repeated captures", () => {
    for (const pattern of ["+(*[ab])", "+(a?*)", "+(*a/b)", "+(**)", "+(*[)"]) {
      expect(picomatch.makeRe(pattern).exec(pattern)?.[0]).toBe(pattern);
      expect(picomatch.isMatch("aaa", pattern)).toBe(false);
    }

    const pattern = "+(*a)";
    expect(Array.from(picomatch.makeRe(pattern, { capture: true }).exec(pattern) ?? [])).toEqual([pattern]);
    expect(picomatch.isMatch("aaa", pattern, { capture: true })).toBe(false);
  });

  it("preserves quoted, escaped and character-class literal stars", () => {
    for (const pattern of ['+("*a")', "+(\\*a)", "+([*])", "+([*a])"]) {
      expect(picomatch.makeRe(pattern).source)
        .toBe(picomatch.makeRe(pattern, { maxExtglobRecursion: false }).source);
    }
    expect(picomatch.isMatch("*a*a", '+("*a")')).toBe(true);
    expect(picomatch.isMatch("*a*a", "+(\\*a)")).toBe(true);
    expect(picomatch.isMatch("***", "+([*])")).toBe(true);
  });
});
