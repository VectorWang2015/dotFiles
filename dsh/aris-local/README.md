# Reproducible local ARIS overlay

This is the **only ARIS directory intended for dotFiles maintenance**. It contains 21 allowlisted local overlay files, a separate Standard override, reconstruction tests and the offline-capable rebuild script. No upstream corpus, archives, node_modules, results, user profiles, conversations or credentials belong here.

## Pinned inputs

- Runtime base: [npm dsh-aris 0.1.1](https://registry.npmjs.org/dsh-aris/-/dsh-aris-0.1.1.tgz), integrity `sha512-1dG7p508fySK/aMUSnSeiWLEWttLOj84KufBNJlq6xNQGT8ulY/4/KzHzJrR5B2oRr6MjW/Eg0QJQmOV76K9nA==`.
- Resources: [upstream commit 2132036060e03e8d0df69a4b21e5971819c0c2d6](https://github.com/wanshuiyin/Auto-claude-code-research-in-sleep/tree/2132036060e03e8d0df69a4b21e5971819c0c2d6), codeload tar.gz SHA-256 `9db2b3f49bb7c2ade2700b0c205f5f6e4e13fa4547e2f6c0f867f00ad2818b55`.
- Result: private `dsh-aris@0.1.1-local.3`; exact peers DSH, skill-filesystem and mcp-client `0.2.0-rc.2`.
- DSH target: `639ed015397290b3745d163aafe02ffee4aa3f84`. Standard preset, filesystem provider and preset registry source match the prior `0.1.7-rc.2` baseline; built-target tests, not the version edit alone, establish compatibility.

## Reconstruct

Requires Python 3.12+ for safe tar extraction (deployed Codex bridge remains Python 3.9+).

```sh
python3 rebuild.py --out /absolute/new/aris-build
# Fully offline, using both verified archives:
python3 rebuild.py --archive /path/to/dsh-aris-0.1.1.tgz \
  --resource-archive /path/to/upstream-2132036.tar.gz --out /absolute/new/aris-build
python3 -B test_rebuild.py
```

The script refuses an existing destination, verifies both hashes before output, rejects unsafe or duplicate members, and asserts that the native skill names remain exactly the same 83. It extracts the npm runtime, replaces only `skills`, `tools`, `templates`, `mcp-servers` with commit-pinned resources, then applies the local allowlist. Upstream host config/default model/global skill mounts are **never** imported. Six selected upstream helper test files plus their HOME-isolating conftest are extracted into the test-only `upstream-tests` directory, excluded from npm packaging. No package scripts or installers run. Missing archive arguments fetch only the two public pinned URLs.

## Validate and pack

Use a new throwaway HOME and a built target checkout; never inherit credential variables. In reconstructed `package`:

```sh
TEST_HOME=$(mktemp -d /tmp/aris-validation-XXXXXX)
env -i PATH="$PATH" HOME="$TEST_HOME" TMPDIR="$TEST_HOME" \
  DSH_CHECKOUT=/absolute/path/to/built/deepseek-harness-0.2.0-rc.2 \
  node --test tests/*.test.mjs
python3 -B tests/helpers-offline.py
env -i PATH="$PATH" HOME="$TEST_HOME" npm_config_cache="$TEST_HOME/npm-cache" \
  npm pack --ignore-scripts --pack-destination ..
```

The helper runner requires an installed pytest, clears the environment, creates its own temporary HOME and blocks socket operations and external process execution. Tests mock HTTP and system tools; the lock regression forks only test workers. No watchdog daemon, real model, Codex command, credential or network request is used.

## Deployment contract

The parent deployer installs the tarball into an **isolated profile first**, and applies `standard-local.patch.yml` after the Web bundle. That override is deliberately separate: it retains local Copilot compaction tuning and enabled Ralph without adding ARIS to Standard. Research retains stable id `research`, the same Standard tool composition plus those local policies, and one scoped `dsh-aris/skills` row. Default model and preset selections are untouched.

Local runtime-only/Research-only separation, per-session client injection, inactive checkout overlay and Codex exec bridge are preserved. `run-status.mjs`, `scope-limits.mjs`, `codex.mjs` remain npm-supplied; Python bridge code is also byte-identical to npm. No upstream resources are duplicated in this maintenance directory.

Offline checks do not prove full Web rendering, migrated-history continuation or authenticated review. Keep one ARIS runtime only; do not re-enable retired global skill or duplicate file-URL runtime mounts. This package never migrates history, operates services, installs live profiles, commits or pushes.
