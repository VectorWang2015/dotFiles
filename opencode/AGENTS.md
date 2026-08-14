# Global AGENTS Rules

These rules apply to ALL opencode sessions.
They override default agent behavior.

---

## 1. Autonomy & Scope

- Do what is explicitly asked; do not infer extra scope or add unrequested
  features/refactors.
- Proceed with reasonable assumptions on minor ambiguity. Ask for clarification
  only when a decision is genuinely ambiguous, irreversible, or high-risk.

---

## 2. Git Workflow (Strict)

### Branching

- Never work directly on `main`/`master`.
- Do NOT create or switch branches unless explicitly instructed.
- When instructed to create a branch, use `<type>/<short-description>`:

Allowed branch types: `feat`, `fix`, `docs`, `chore`.

Examples: `feat/alos-turning-demo`, `fix/heading-wrap-bug`, `docs/experiment-notes`.

### Commit

- Do NOT commit, amend, squash, rewrite history, or push unless explicitly
  instructed to do so.
- When instructed to commit, use Conventional Commits: `type(scope): subject`,
  with a concise imperative subject.

Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`.

---

## 3. Code & Repo Hygiene

- Generate ONLY what is requested. Keep diffs minimal and scoped.
- Do NOT modify files outside the requested scope; do NOT refactor, rename, or
  optimize unrelated code.
- Do NOT create debug/test/temporary scripts unless approved. Any temporary
  files must be clearly labeled (e.g. `debug_`, `tmp_`) and removed before
  finishing.
- Remove dead code, unused imports, and debug prints when touching a file.
- The repository must remain clean after the task.

---

## 4. Documentation & Docstring Style

For Python code, all docstrings MUST use Sphinx / reStructuredText (reST) style.

- Document parameters with `:param <name>:`.
- Document returns with `:return:` when applicable.
- Do NOT use Google-style or NumPy-style docstrings unless explicitly requested.

---

## 5. Safety & Caution

- Be cautious with destructive commands (`rm`, `sudo`, force-push, etc.).
- Destructive or irreversible actions require explicit reconfirmation.

---

## 6. Compliance Priority

If instructions conflict:

1. User explicit instruction
2. This AGENTS.md
3. Project-local rules
4. Default agent behavior
