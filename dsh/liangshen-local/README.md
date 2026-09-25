# LiangShen 0.4.2 registry-startup compatibility patch

## Diagnosis and scope

`@linxin666/dsh-liangshen@0.4.2` declares only `systemPrompt` in its Host `inject`. Its first asynchronous effect calls `ctx.get('agentPresets')` exactly once; if the registry provider has not become active, it logs a warning and never retries. The aggregate shell can therefore report an active, non-degraded LiangShen plugin while `/api/agentPresets/list` contains no `liangshen`. The actual published `lib/index.js` has the same defect as `src/index.ts`; the preset files are present and parse successfully.

The package-root patch adds `agentPresets` to the Host dependencies in **both** files. Cordis now waits for the provider before activation. No retry loop, copied Standard preset, new registry, UI modification, service restart, or historical-session rewrite is needed. The shipped preset composition and all preset-local tool modules remain byte-identical.

## Upstream pins

- DSH: built `0.1.7-rc.2` checkout (tests refuse a different version).
- Aggregate: `@linxin666/dsh-web-all@0.4.2`.
- Subject: `@linxin666/dsh-liangshen@0.4.2`, repository https://github.com/zhu1090093659/dsh-web.git .
- npm archive: https://registry.npmjs.org/@linxin666/dsh-liangshen/-/dsh-liangshen-0.4.2.tgz .
- npm archive integrity: `sha512-odAf6gJXYLo4TQAboMeo7SsH8SkCTM5at5rN2JLBQmtfxu+r1uQrCqRQyBSWEIXqrH0CCqX3wDcK5z5Fo7Sg6w==` (matches the staged pnpm lock).
- Original `src/index.ts` SHA-256: `05a01710e52460ee0c125c04a87f9d135bc6cdd27375983a79a92250b95a2149`.
- Original `lib/index.js` SHA-256: `879785aeb52e0c986357bda42fd91e01f7b5eec4ba39cf7fad9dff0b43c27195`.

The npm archive retains its upstream Apache-2.0 LICENSE and preset NOTICE. Generated old `~/.dsh/.agent-presets/liangshen` files are third-party output and are not copied, modified, or treated as custom application source.

## Assembly

Use `linxin666__dsh-liangshen@0.4.2.patch` as a **package-root pnpm patchedDependency** for exactly `@linxin666/dsh-liangshen@0.4.2`. Keep both direct and aggregate-transitive dependency resolutions on that patched package and commit the resulting pnpm lock. Do not change its package name or client identity, and keep the existing aggregate row `web-ui-liangshen` explicitly `disabled: false`.

For pnpm versions using `pnpm-workspace.yaml` settings, the entry is:

```yaml
patchedDependencies:
  '@linxin666/dsh-liangshen@0.4.2': ./patches/linxin666__dsh-liangshen@0.4.2.patch
```

Use the profile's existing pnpm configuration location rather than duplicating competing settings. The package-root patch passed `git apply --check` against the installed original and the integrity-verified npm archive. This maintenance directory does not install into a runtime profile or restart any service. The `fixed.overlay.yml` file is **test-only**, not a production profile override.

## Reproduction and focused tests

Copy the commit-worthy files below to a fresh maintenance directory and run:

```sh
node prepare.mjs
DSH_CHECKOUT=/absolute/path/to/deepseek-harness-0.1.7-rc.2 node --test registry.test.mjs
```

`prepare.mjs` downloads and verifies the exact npm archive, extracts `upstream/`, copies it to `patched/`, and applies the package-root patch there. It refuses to overwrite existing prepared packages. All generated files stay beside this README. Tests consume existing built DSH/Cordis artifacts and never rebuild or modify the checkout. No real model, private token, user session, or running service is used.

The test-only `repro.cordis.yml` boots through rc.2's real `boot`/Loader. `delayed-registry.mjs` supplies the real AgentPresetRegistry after the plugin has had a chance to start. Without the overlay the preset disappears; `fixed.overlay.yml` selects the patched artifact and the preset registers. Loader patch `name` is a matching guard, not module replacement, so the test overlay disables the original row and inserts the patched test row.

Final result: **10 tests passed, 0 failed** (`test-results.tap`). Coverage:

1. Real YAML Loader reproduction and fixed overlay.
2. Original artifact's late-provider failure.
3. Actual patched artifact waits, registers unchanged composition, unregisters, and remounts.
4. Both versions work if the provider was already active; identity remains `liangshen`.
5. `enabled: false` remains effective.
6. Every bundled preset file plus package manifest, bundle patch, and browser artifact is byte-identical.
7. Real rc.2 Tools executes `fact_register`, rejects missing facts, and disposes the registration.
8. Real rc.2 Tools executes `tool_activate`, rejects an unknown namespace, and disposes the registration; the only external-tool canary is local and never called.
9. Serialized paging/fact history replay and three-namespace LRU behavior.
10. Real prompt assembly preserves persona, plan policy, and workspace while removing unrelated Standard guidance.

These intentionally narrow registry tests do not install all shell/fs/subagent providers, so their registry diagnostic correctly reports those missing providers. They demonstrate declaration, not full deployment readiness. The parent integrator separately reported that the patched full 3081 deployment lists `liangshen` **without `broken`**, with `health-release-candidate.json` passing authentication, model route, task board, and parent/child historical-session checks. That full-server evidence belongs to the parent, not this fixture.

## Semantics and historical sessions

The stable identity `liangshen` remains available for the four historical sessions. This patch does not alias it to Standard or rewrite stored events. However, **the upstream 0.4.2 upgrade itself changes LiangShen behavior**: the old generated preset used an initial two-tool anchor, promotion to PTC, and persistent bash; 0.4.2 uses its own minimal disciplined persona, default `both` native/PTC presentation, standard ephemeral shell, paging, degeneration guard, and fact ledger. The patch preserves that new upstream behavior exactly. Identity continuity is not a promise to reproduce the old package's prompt/tool semantics.

## Commit-worthy files and retirement

Commit only `README.md`, `.gitignore`, `linxin666__dsh-liangshen@0.4.2.patch`, `prepare.mjs`, `checkout.mjs`, `registry.test.mjs`, `repro.cordis.yml`, `fixed.overlay.yml`, and `delayed-registry.mjs`. Archive/copies/test logs are reproducible local outputs, not maintained forks. No vendored preset or built client is needed in the maintenance commit.

When upstream adds the dependency (or equivalent lifecycle-safe registry injection), remove this exact-version patch, refresh the profile lock, rerun the focused tests against the candidate artifact, and verify the full registry plus historical-session read/resume paths before cutover.
