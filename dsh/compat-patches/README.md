# Local DSH 0.2.1 compatibility patches

These narrow patches retain changes for local plugin trees without a Git repository. Apply only to the matching existing local source (`git apply --check`, then `git apply` in its directory). They contain no account credentials or session histories.

- Four WeChat bridges: target version declaration and offline test updates. Vision now distinguishes human input from DSH runtime-context messages; a second human request is still rejected. Fixed group/owner, ports, paths, tool restrictions, send limits and idempotency remain unchanged. Deployment retains the original source-link/HMR paths.
- Copilot board0.1.1: adds DSH Connection authentication/same-origin checks, exact request methods and bounded diagnostic-body accumulation. Existing gateway/account state and pricing behavior remain unchanged.
- Synthetic full-host validation passed all four bridge generations, cached replays, conflicting-key refusal, native PNG decoding and MIME-mismatch rejection. No real WeChat sending or external model call was used. Copilot UI was verified against a synthetic quota server.

Apply bridge code changes only during the coordinated Host maintenance window; the production HMR watches those source directories. Do not copy test-only path/port transformations, synthetic model overlays, temporary homes, or temporary ledger data into production.
