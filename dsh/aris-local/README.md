# Reproducible local ARIS overlay

This directory is the **only ARIS material intended for dotFiles commit**. It contains 19 allowlisted text overlay files, one separate Standard configuration override, and this offline-capable reconstruction script. It contains no upstream skill corpus, tarball, node_modules, test outputs, conversation logs, profile files, API keys, or authentication files.

## Reconstruct

Requirements for this maintainer script: Python 3.12+ (safe tar data filter). The deployed Codex bridge itself still needs only Python 3.9+.

```sh
python3 rebuild.py --out /absolute/new/aris-build
# Offline alternative:
python3 rebuild.py --archive /path/to/dsh-aris-0.1.1.tgz --out /absolute/new/aris-build
```

The output directory must not exist. The script checks the exact SHA-512 before extracting, rejects traversal, links and special files, overlays only its explicit allowlist, and never runs package scripts or modifies a live profile. It downloads only the public npm archive if `--archive` is omitted.

Pin:

- npm `dsh-aris@0.1.1`
- URL `https://registry.npmjs.org/dsh-aris/-/dsh-aris-0.1.1.tgz`
- integrity `sha512-1dG7p508fySK/aMUSnSeiWLEWttLOj84KufBNJlq6xNQGT8ulY/4/KzHzJrR5B2oRr6MjW/Eg0QJQmOV76K9nA==`
- resulting local version `0.1.1-local.2`
- peer target DSH `0.1.7-rc.2`, official source `477b4f420553e8a52c2fbccc464d7561b239c443`

## Validate and pack

In the reconstructed `package` directory:

```sh
DSH_CHECKOUT=/absolute/path/to/built/deepseek-harness-0.1.7-rc.2 node --test tests/*.test.mjs
npm pack --ignore-scripts --pack-destination ..
```

The parent deployer pins that tarball into an **isolated profile first** and appends `standard-local.patch.yml` after the Web bundle. The latter is not an ARIS bundle file: it preserves the deployment's Copilot gateway-specific compaction tuning without putting ARIS skills into Standard. No command here installs plugins, changes default models/presets, migrates history, starts a server, commits, or pushes.

## Overlay inventory

- Manifest, local README pair and LOCAL-CHANGES: exact compatibility, provenance and deployment contract.
- `dsh/index.mjs`, `runtime.mjs`, `skills.mjs`: local runtime-only / Research-only split.
- `dsh/cordis.patch.yml`: one runtime, optional scope limits, upstream Codex exec bridge, no model-default override.
- `dsh/client.js`: rc.2 per-session slot injection and read-only RPC callback.
- `dsh/checkout.patch.yml`: intentionally inactive; upstream development overlay mounted skills globally.
- `presets/research.patch.yml`: rc.2 Standard + local compaction policy + scoped ARIS skills.
- `tests`: focused real-registry/patch-engine and offline protocol tests.

`run-status.mjs`, `scope-limits.mjs`, `codex.mjs`, the Python Codex bridge, and all 83 skills/resources are **not overlays**: the verified upstream tarball supplies them byte-for-byte. Do not duplicate them in Git unless a future actual change requires a new explicit overlay and version.

## Remaining integration boundary

Offline tests passed against the built target checkout, but they do not verify a running browser or persisted-session migration. Old V0 session-format failures and old Codex thread-option migration are not repaired by this package. Remove the previous extra file-URL `aris-runtime` row when activating the new single bundle runtime; avoid concurrent mounts and duplicate `/aris` handlers. Actual authenticated reviewer calls require separate operator acceptance.
