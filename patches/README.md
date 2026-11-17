# picomatch security patches

The patches for picomatch 2.3.2 and 4.0.7 mitigate
[GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf).
As of November 17, 2026, npm has no published fixed version.

The simple repeated-star rewrite is based on the open upstream proposals
[#237](https://github.com/micromatch/picomatch/pull/237) and
[#246](https://github.com/micromatch/picomatch/pull/246). A branch such as `+(*a)`
can absorb its own repetition, so it does not need a nested unbounded quantifier.
For capture mode or more complex branches, such as `+(*[ab])`, these patches use
picomatch's existing literal fallback. Those patterns match their literal text
instead of acting as repeated extglobs. Quoted and escaped stars and stars inside
character classes retain their existing behavior. The upstream explicit
`maxExtglobRecursion: false` opt-out remains unchanged.

The regression tests in `src/lib/security/picomatch.test.ts` exercise both actual
dependency paths, check matching compatibility, and isolate adversarial inputs
in child processes with a deadline. Versions are not relabeled, so version-based
audit tools may continue to report the advisory. Replace these patches with an
official fixed release when one becomes available and passes these checks.
