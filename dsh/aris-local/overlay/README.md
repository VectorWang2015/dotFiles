# ARIS for DSH 0.1.7-rc.2 — local isolation release

Version `0.1.1-local.2` combines the published `dsh-aris@0.1.1` corpus/helpers/Codex bridge with the local runtime-only and Research-only isolation design. See [LOCAL-CHANGES.md](LOCAL-CHANGES.md) for the merge record and deployment cautions; [中文](README_CN.md).

## Installation and composition

Package and pin this directory as a local tarball, not `dsh-aris@latest`: the public package does not contain these isolation changes. The package's `dsh.bundle.patch` loads the host patch and `presets/research.patch.yml`, in that order, after the Web bundle. It registers stable preset id `research` with the DSH 0.1.7-rc.2 Standard child-plugin list, the local `copilot-chat` / `claude-opus-5-5` compaction policy (`thresholdRatio: 0.3`, `retainRatio: 0.08`), the existing enabled Ralph tool, and `dsh-aris/skills`. The standalone Standard override also explicitly keeps Ralph enabled, unlike the new upstream default. It does not change the selected model or default preset. The old `.agent-presets/research` directory is not a registration mechanism in this DSH version.

The host row retains id `aris-skills` for compatibility with profile patch targets, but its default module mounts only the runtime. It exports `ARIS_REPO` when unset, projects Codex continuation metadata into tool content, and exposes the read-only `/aris` view. The skills module registers exactly the upstream **83** top-level bundles in the Research scope; Standard and host scopes cannot list or load them through this provider. The added upstream skill is `research-implement-feature`. This isolation is catalog scoping, not a security sandbox.

The Research configuration is an explicit snapshot, not dynamic Standard inheritance. Existing sessions retain id `research`; a process restart resolves that id against the new declaration. Default selection is an independent operator decision. Do not also mount a second runtime through an old file-URL override.

## Runtime dependencies

- DSH, `dsh-skill-filesystem`, and `dsh-mcp-client`: peer-pinned to `0.1.7-rc.2`.
- Node `^22.19.0 || >=24.0.0`; the checked host has Node 22.23.2 and pnpm 11.7.0.
- Python 3.9+ as `python3` on PATH; bridge uses only the standard library.
- Codex on PATH, authenticated by the operator. The checked binary reports 0.153.4. No credentials were read and no paid reviewer request was run during this migration.

The upstream bridge invokes `codex exec`, including with Codex 0.153.4, rather than relying on the removed `mcp-server` command. The profile preserves a 20-minute MCP timeout and `failOnStartupError: true`. It does not override the reviewer's model or reasoning effort. Successful calls may store thread options under the upstream default `~/.codex/state/codex-exec`; old pre-bridge threads have no such bridge-owned option record. Legacy `approval-policy`, `base-instructions`, `developer-instructions`, and `compact-prompt` arguments are not exposed by this bridge.

## Verification

`node --test tests/*.test.mjs` uses the built rc.2 checkout through a guarded test-only resolver. Tests cover runtime lifecycle, real Cordis waterfall behavior, actual skill-provider scoping/inheritance/disposal, all 83 skill bodies, rc.2 bundle patch composition, browser session injection, and an offline Python MCP initialize/tools-list exchange. Tests use no user profile, credential, model request, or running GUI. Full assembled Web selection, migrated-history resume, and actual reviewer calls remain deployment acceptance tasks.

## Upstream

The workflow corpus, alternate host variants, helpers, templates, and MCP servers are copied byte-for-byte from [dsh-aris 0.1.1](https://registry.npmjs.org/dsh-aris/0.1.1), not rewritten. Their documentation and workflows remain available in the package and [upstream project](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep).
