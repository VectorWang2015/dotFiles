# Global AGENTS Rules

These rules apply to ALL opencode sessions.
They override default agent behavior.

---

## 1. Authority & Scope

- The agent MUST NOT infer intent beyond what is explicitly stated.
- When uncertainty exists, the agent MUST ask before acting.

Default mode is **analysis-only**.

---

## 2. Git Workflow (Strict)

### Branching

- The agent MUST NOT work on main branch.
- Any new feature or experiment MUST be done on a new branch.
- The agent MUST NOT create or switch branches unless explicitly instructed.

- If the agent IS explicitly instructed to create a branch,
  it MUST follow the branch naming convention:

```
<type>/<short-brief-description>
```

Allowed branch types include:
- feat   (new feature)
- fix    (bug fix)
- docs   (documentation only)
- chore  (maintenance / tooling)

Examples:
- feat/alos-turning-demo
- fix/heading-wrap-bug
- docs/experiment-notes

---

### Commit

- The agent MUST NOT commit code unless explicitly instructed.
- The agent MUST NOT amend, squash, or rewrite git history.
- The agent MUST NOT push to any remote repository.

- If the agent IS explicitly instructed to write a commit message,
it MUST follow the **Conventional Commits** format:

```
<type>(<scope>): <subject>

<body> (optional)

<footer> (optional)
```

Allowed commit types:

- feat: new feature
- fix: bug fix
- docs: documentation
- style: formatting (no code behavior change)
- refactor: refactoring without functional change
- test: adding or updating tests
- chore: build process or auxiliary tools

The subject line MUST be concise and imperative.

Allowed:

- Showing git commands as examples (dry-run, text only)
- Proposing a git workflow plan and waiting for confirmation

---

3. File Creation & Cleanup

The agent MUST NOT create debug, test, or temporary scripts
unless explicitly approved.

If any temporary files are created:

- They MUST be clearly labeled (e.g. debug_, tmp_)
- They MUST be removed or reverted before final output, unless approved by user

Default assumption:

- The repository must remain clean after the task.

---

4. Code Modification Rules

- Generate ONLY what is explicitly requested.
- Do NOT refactor, rename, or optimize unrelated code.
- Do NOT modify files outside the explicitly mentioned scope.

---

5. Documentation & Docstring Style

For Python code, all docstrings MUST use
Sphinx / reStructuredText (reST) style.

- Parameters MUST be documented using the :param <name>: format.
- Return values MUST be documented using :return: when applicable.
- Do NOT use Google-style or NumPy-style docstrings unless explicitly requested.

---

6. Behavior Expansion Control

The agent MUST ask for permission BEFORE:

- Performing actions not explicitly requested
- Adding auxiliary scripts or tooling
- Making structural or architectural changes
- Taking actions that affect git history or repository state

The agent MUST present a short action plan and wait for approval.

---

7. Safety & Caution

- Be extremely cautious with destructive commands (rm, sudo, etc.).
- Even if allowed, destructive actions require explicit reconfirmation.

---

8. Compliance Priority

If any instruction conflicts:

- User explicit instruction
- This AGENTS.md
- Project-local rules
- Default agent behavior
