# Local ARIS upgrade record

Version: `0.1.1-local.2`; target DSH: `0.1.7-rc.2` (`477b4f420553e8a52c2fbccc464d7561b239c443`).

## Inputs and merge decisions

- Upstream archive: https://registry.npmjs.org/dsh-aris/-/dsh-aris-0.1.1.tgz
- npm SHA-1: `059c90eaff2b6948ae6deaf90ec20ae61362b707`.
- npm integrity: `sha512-1dG7p508fySK/aMUSnSeiWLEWttLOj84KufBNJlq6xNQGT8ulY/4/KzHzJrR5B2oRr6MjW/Eg0QJQmOV76K9nA==`.
- Local predecessor: `0.1.1-local.1`, itself based on upstream 0.1.0. Its runtime/skills separation is preserved, not its stale Standard copy or user-specific deployment scripts.
- The complete `skills`, `tools`, `templates`, `mcp-servers` directories are byte-identical to upstream 0.1.1. This includes the new `research-implement-feature` skill: 83 native top-level bundles rather than 82. Nested alternate-host corpora remain resources, not extra native catalog entries.
- The upstream `dsh/codex.mjs`, `dsh/run-status.mjs`, and `dsh/scope-limits.mjs` are unchanged. The reviewer bridge is new upstream behavior; it uses Python stdlib and `codex exec` instead of `codex mcp-server`.

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
