@AGENTS.md

# Working agreement

`AGENTS.md` and `SPEC.md` say what this project is. This file says how to work in it.

These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think before coding

Don't assume. Don't hide confusion. Surface tradeoffs.

- State assumptions explicitly. If uncertain, ask.
- If multiple readings of the request exist, present them — don't pick one silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

`SPEC.md` settles design and scope questions. When the spec and the request disagree, that
is a question for the user, not a judgment call — and the §8 hard rules are never a call an
implementation session gets to make.

## 2. Simplicity first

The minimum code that solves the problem. Nothing speculative.

- No features beyond what was asked. No abstractions for single-use code.
- No "flexibility" or "configurability" that nobody requested.
- No error handling for states that cannot occur.
- If you wrote 200 lines and it could be 50, rewrite it.

The test: would a senior engineer call this overcomplicated? Then simplify.

## 3. Surgical changes

Touch only what you must. Clean up only your own mess.

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor what isn't broken. Match the surrounding style even if you'd write it
  differently.
- Unrelated dead code: mention it, don't delete it.
- Remove only the imports and variables that _your_ change orphaned.

The test: every changed line traces directly to the request.

`public/resorts/` is baked output. Change `scripts/` and re-bake — never hand-edit an
artifact to make something look right.

## 4. Goal-driven execution

Define success criteria, then loop until they're met.

- "Add validation" → write tests for the invalid inputs, then make them pass.
- "Fix the bug" → write a test that reproduces it, then make it pass.
- "Refactor X" → tests green before and after.

For multi-step work, state the plan as steps, each with the check that proves it:

```
1. [step] → verify: [check]
2. [step] → verify: [check]
```

Numerical work is settled by `npm test`; visual work is settled by a human looking at it. A
new run statistic isn't done until the bake computes it and a test pins the number.

Before handing work back, all four pass: `npm run format:check`, `npm run lint`,
`npm run typecheck`, `npm test`. Changing bake math also means re-baking and committing the
affected artifacts — stale numbers in `public/resorts/` are a wrong answer on the site.

## 5. Comments earn their place

Code says what. Comments say why, and only when why isn't obvious. Default to no comment —
readable code with honest names is the documentation.

Write one only when:

- A choice looks wrong until you know the constraint: a workaround, an ordering
  requirement, a rounding rule, an upstream bug.
- A non-obvious invariant must hold and nothing in the types enforces it.
- A function's contract isn't clear from its signature — one short doc comment above it,
  not a play-by-play inside it.

Never write a restatement of the next line, narration of what the code used to do, an essay
justifying a design decision, a section banner, or a TODO with no owner. Keep them to a line
or two; a comment longer than the code it describes is a smell.

The test: delete it. If a competent reader still follows the code and wouldn't reintroduce
the bug it warned about, it stays deleted.

**The surrounding prose is not a licence.** §3 says match the surrounding style; it means
naming, structure and idiom, never comment volume. Some comments in this repo are longer
and more discursive than this section allows. Do not take them as the standard, do not
write more like them, and do not rewrite them — leave them alone and hold new comments to
the rules above.

Hard limits on anything you add:

- Three lines for a doc comment, one for an inline comment. Over that, the code needs
  a better name or a smaller function, not more prose.
- State the constraint, don't tell its story. "Clamped: a masthead plus a raised sheet can
  exceed a short window, and a zero-height frame is a NaN aspect" — not a paragraph
  about how the layout came to be that way.
- No second voice. Don't explain a decision to the reader, address them, or narrate what
  the change replaced; git history holds that.
- A test name is a comment. If the `it(...)` string says it, don't say it again inside.

## Automation

Formatting and hygiene are enforced by tooling, not by remembering:

- `.claude/hooks/` — Prettier runs on every file an agent writes; edits to
  `public/resorts/` are refused and edits to `SPEC.md` need confirmation; a turn that
  touched TypeScript ends with `typecheck` and `test`.
- `.husky/pre-commit` — `lint-staged` formats and lints staged files.
- `.github/workflows/ci.yml` — format, lint, typecheck, test, build on every push and PR.

These catch mistakes; they don't excuse making them.
