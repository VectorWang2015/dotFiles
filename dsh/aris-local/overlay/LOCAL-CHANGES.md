# Local ARIS upgrade record

Version: `0.1.1-local.3`; target DSH: `0.2.0-rc.2` (`639ed015397290b3745d163aafe02ffee4aa3f84`).

## Inputs and merge decisions

- Upstream archive: https://registry.npmjs.org/dsh-aris/-/dsh-aris-0.1.1.tgz
- npm SHA-1: `059c90eaff2b6948ae6deaf90ec20ae61362b707`.
- npm integrity: `sha512-1dG7p508fySK/aMUSnSeiWLEWttLOj84KufBNJlq6xNQGT8ulY/4/KzHzJrR5B2oRr6MjW/Eg0QJQmOV76K9nA==`.
- Local predecessor: `0.1.1-local.2` on DSH `0.1.7-rc.2`; its runtime-only/Research-only split, compaction policies, Ralph availability, client injection and bridge are preserved.
- Resource source: exact upstream main commit `2132036060e03e8d0df69a4b21e5971819c0c2d6` (2026-09-29); codeload archive SHA-256 `9db2b3f49bb7c2ade2700b0c205f5f6e4e13fa4547e2f6c0f867f00ad2818b55`. The complete `skills`, `tools`, `templates`, `mcp-servers` trees match that commit byte-for-byte. The native catalog remains the same 83 bundles; nested alternate-host corpora remain resources, not additional catalog entries.
- Changed native skills: alphaxiv, auto-paper-improvement-loop, auto-review-loop, deepxiv, overleaf-sync, paper-claim-audit, paper-plan, resubmit-pipeline, wiki-enrich. Four Codex mirrors and shared reviewer-routing also change. Seven helpers change: arxiv_fetch, check_skills_inventory, convert_skills_to_llm_chat, generate_codex_claude_review_overrides, research_wiki, verify_papers, watchdog. Templates are unchanged; MCP changes are limited to the Codex exec README.
- Reliability updates include 401/403/406 `verify_pending` rather than false fabrication signals, retrying pending cache entries, Semantic Scholar key/429 pacing and retry, arXiv HTTPS/curl fallback, watchdog read-modify-write flock, canonical AlphaXiv URLs and orchestrating Skill grants. These are corpus/tool changes, not new global DSH permissions.
- Main has no DSH runtime tree. The npm `dsh/codex.mjs`, `dsh/run-status.mjs`, `dsh/scope-limits.mjs` and Python Codex exec bridge implementation remain unchanged. Upstream default models, global skills and installer behavior are not imported.
- Standard YAML, skill-filesystem and agent-preset-registry source were re-compared against DSH `0.1.7-rc.2` and are identical. Local declarations therefore change only provenance comments; exact peer bumps are validated against actual built `0.2.0-rc.2` modules.

## Local overlay

- `package.json`: private local version, exact DSH peers, runtime/skills exports, two ordered bundle patches.
- `dsh/index.mjs`: runtime-only re-export.
- `dsh/runtime.mjs`, `dsh/skills.mjs`: preserved local split; no global ARIS corpus.
- `dsh/cordis.patch.yml`: runtime-only historical row id, upstream Codex exec bridge, no default-model override.
- `dsh/client.js`: rc.2 session-scoped slot injection supplies session id and an RPC callback, rather than reading removed owner props or passing a service into the component.
- `dsh/checkout.patch.yml`: inactive empty patch; the old development overlay leaked skills globally and is no longer exported.
- `presets/research.patch.yml`: explicit rc.2 Standard composition plus local gateway compaction policy and scoped ARIS provider. Stable declaration row `preset-research`, session identity `research`.
- `../standard-local.patch.yml`: standalone complete config override for shipped `preset-standard`; contains the same compaction policy but no ARIS skills. The parent assembler applies it after the Web bundle. It is deliberately not in the ARIS bundle because the setting belongs to the local deployment, not ARIS.
- README files and offline tests document the current local release.

## Assembly cautions

Install only one ARIS runtime. Remove or disable the old deployment's extra `aris-runtime` file-URL row and any retired global skill mount; otherwise both runtime listeners/RPC channels may register. Keep the existing model choice. The default Research selection is not changed by this bundle; use the new `agent-preset-registry` settings or a separate explicit default patch. The rc.2 Standard baseline disables Ralph by default; this local Research declaration and the separate Standard override explicitly set `tool-ralph.disabled: false` to retain the previous installation's tool availability. Both adopt the new workflow-ptc executor.

The Codex bridge's supported tools differ from the old native MCP server: no `approval-policy`, `base-instructions`, `developer-instructions`, or `compact-prompt`; old threads do not have the new bridge's stored continuation options. No API key or auth file was inspected. No paid model call was run. The bridge's first real request can still fail if Codex authentication or endpoint settings are invalid.

This package does not migrate persisted sessions. In particular it cannot repair unknown V0 custom events or historic subagent descriptor failures in DSH's V0→V4 chain. Full Web boot/preset selection/continued-history validation belongs to the isolated deployment acceptance step.

## Tests

Built DSH rc.2 Cordis, scope, skills, filesystem provider, and include parser are used directly by the guarded resolver. Unit/registry tests cover scope isolation, runtime lifecycle and metadata projection. Composition tests parse/apply real bundle patches. Browser injection is tested through the shipped module factory. The Python bridge test sends only initialize/tools-list with an isolated HOME and an invalid CODEX_BIN, making a real Codex/LLM call impossible.
