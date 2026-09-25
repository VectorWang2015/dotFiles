#!/usr/bin/env python3
"""Reconstruct the private ARIS package from a verified npm archive and local overlay.

No install scripts, model calls, user configuration reads, or profile changes.
The destination must not exist. Python 3.12+ supplies tar's safe data filter.
"""
import argparse
import base64
import hashlib
import io
from pathlib import Path
import shutil
import tarfile
import urllib.request

URL = "https://registry.npmjs.org/dsh-aris/-/dsh-aris-0.1.1.tgz"
INTEGRITY = "sha512-1dG7p508fySK/aMUSnSeiWLEWttLOj84KufBNJlq6xNQGT8ulY/4/KzHzJrR5B2oRr6MjW/Eg0QJQmOV76K9nA=="
OVERLAY_FILES = (
    "package.json", "README.md", "README_CN.md", "LOCAL-CHANGES.md",
    "dsh/index.mjs", "dsh/runtime.mjs", "dsh/skills.mjs", "dsh/cordis.patch.yml",
    "dsh/client.js", "dsh/checkout.patch.yml", "presets/research.patch.yml",
    "tests/README.md", "tests/checkout.mjs", "tests/client.test.mjs",
    "tests/codex-bridge.test.mjs", "tests/deployment.test.mjs", "tests/fixtures.test.mjs",
    "tests/runtime.test.mjs", "tests/scope.test.mjs",
)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, required=True, help="new private output directory")
    parser.add_argument("--archive", type=Path, help="existing npm archive; skips network")
    args = parser.parse_args()
    out = args.out.resolve()
    if out.exists():
        parser.error(f"refusing existing destination: {out}")
    here = Path(__file__).resolve().parent
    payload = args.archive.read_bytes() if args.archive else urllib.request.urlopen(URL, timeout=60).read()
    observed = "sha512-" + base64.b64encode(hashlib.sha512(payload).digest()).decode("ascii")
    if observed != INTEGRITY:
        parser.error(f"npm archive integrity mismatch: {observed}")
    # Preflight both archive membership and every allowlisted overlay before writing.
    for name in OVERLAY_FILES:
        if not (here / "overlay" / name).is_file():
            parser.error(f"missing overlay file: {name}")
    with tarfile.open(fileobj=io.BytesIO(payload), mode="r:gz") as archive:
        for member in archive.getmembers():
            parts = Path(member.name).parts
            if not parts or parts[0] != "package" or ".." in parts or member.issym() or member.islnk():
                parser.error(f"unsupported archive member: {member.name}")
            if not member.isfile() and not member.isdir():
                parser.error(f"unsupported archive member type: {member.name}")
        out.mkdir(parents=True, mode=0o700)
        archive.extractall(out, filter="data")
    for name in OVERLAY_FILES:
        target = out / "package" / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(here / "overlay" / name, target)
    shutil.copyfile(here / "standard-local.patch.yml", out / "standard-local.patch.yml")
    print(f"Verified {INTEGRITY}")
    print(f"Package: {out / 'package'}")
    print(f"Standard override (separate deployment patch): {out / 'standard-local.patch.yml'}")
    print("Next: set DSH_CHECKOUT to a built 0.1.7-rc.2 checkout, then run node --test tests/*.test.mjs in package.")
    print("Package with npm pack --ignore-scripts. This script does not install or switch any profile.")


if __name__ == "__main__":
    main()
