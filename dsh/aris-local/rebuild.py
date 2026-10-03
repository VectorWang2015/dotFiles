#!/usr/bin/env python3
"""Reconstruct npm runtime + SHA-pinned upstream resources + local overlay.

No install scripts, model calls, user configuration reads, or profile changes.
Destination must not exist. Requires Python 3.12+ for tar's safe data filter.
"""
import argparse
import base64
import hashlib
import io
from pathlib import Path, PurePosixPath
import shutil
import tarfile
import urllib.request

URL = "https://registry.npmjs.org/dsh-aris/-/dsh-aris-0.1.1.tgz"
INTEGRITY = "sha512-1dG7p508fySK/aMUSnSeiWLEWttLOj84KufBNJlq6xNQGT8ulY/4/KzHzJrR5B2oRr6MjW/Eg0QJQmOV76K9nA=="
RESOURCE_SHA = "2132036060e03e8d0df69a4b21e5971819c0c2d6"
RESOURCE_ROOT = f"Auto-claude-code-research-in-sleep-{RESOURCE_SHA}"
RESOURCE_URL = f"https://codeload.github.com/wanshuiyin/Auto-claude-code-research-in-sleep/tar.gz/{RESOURCE_SHA}"
RESOURCE_SHA256 = "9db2b3f49bb7c2ade2700b0c205f5f6e4e13fa4547e2f6c0f867f00ad2818b55"
RESOURCE_DIRS = ("skills", "tools", "templates", "mcp-servers")
UPSTREAM_TESTS = (
    "conftest.py", "test_verify_papers.py", "test_verify_papers_s2.py",
    "test_arxiv_fetch.py", "test_research_wiki_fetch_arxiv_metadata.py",
    "test_watchdog.py", "test_watchdog_loop.py",
)
OVERLAY_FILES = (
    "package.json", "README.md", "README_CN.md", "LOCAL-CHANGES.md",
    "dsh/index.mjs", "dsh/runtime.mjs", "dsh/skills.mjs", "dsh/cordis.patch.yml",
    "dsh/client.js", "dsh/checkout.patch.yml", "presets/research.patch.yml",
    "tests/README.md", "tests/checkout.mjs", "tests/client.test.mjs",
    "tests/codex-bridge.test.mjs", "tests/deployment.test.mjs", "tests/fixtures.test.mjs",
    "tests/runtime.test.mjs", "tests/scope.test.mjs",
    "tests/helpers-offline.py", "upstream-tests/test_local_resource_contract.py",
)


def preflight(archive, root):
    """Reject traversal, aliases, links, special files and duplicate members."""
    seen = set()
    for member in archive.getmembers():
        path = PurePosixPath(member.name)
        parts = path.parts
        if (not parts or parts[0] != root or path.is_absolute() or ".." in parts
                or "\\" in member.name or member.issym() or member.islnk()
                or (not member.isfile() and not member.isdir())):
            raise ValueError(f"unsupported archive member: {member.name}")
        if str(path) in seen:
            raise ValueError(f"duplicate archive member: {member.name}")
        seen.add(str(path))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, required=True, help="new private output directory")
    parser.add_argument("--archive", type=Path, help="existing npm archive")
    parser.add_argument("--resource-archive", type=Path, help="existing exact-SHA GitHub archive")
    args = parser.parse_args()
    out = args.out.resolve()
    if out.exists():
        parser.error(f"refusing existing destination: {out}")
    here = Path(__file__).resolve().parent
    payload = args.archive.read_bytes() if args.archive else urllib.request.urlopen(URL, timeout=60).read()
    observed = "sha512-" + base64.b64encode(hashlib.sha512(payload).digest()).decode("ascii")
    if observed != INTEGRITY:
        parser.error(f"npm archive integrity mismatch: {observed}")
    resources = (args.resource_archive.read_bytes() if args.resource_archive
                 else urllib.request.urlopen(RESOURCE_URL, timeout=60).read())
    observed_resources = hashlib.sha256(resources).hexdigest()
    if observed_resources != RESOURCE_SHA256:
        parser.error(f"resource archive integrity mismatch: {observed_resources}")
    for name in OVERLAY_FILES:
        if not (here / "overlay" / name).is_file():
            parser.error(f"missing overlay file: {name}")
    if not (here / "standard-local.patch.yml").is_file():
        parser.error("missing standalone Standard override")
    with tarfile.open(fileobj=io.BytesIO(payload), mode="r:gz") as npm, tarfile.open(fileobj=io.BytesIO(resources), mode="r:gz") as source:
        # Validate both archives and required test/resource trees before any output.
        try:
            preflight(npm, "package")
            preflight(source, RESOURCE_ROOT)
        except ValueError as error:
            parser.error(str(error))
        members = source.getmembers()
        for directory in RESOURCE_DIRS:
            if not any(m.isfile() and m.name.startswith(f"{RESOURCE_ROOT}/{directory}/") for m in members):
                parser.error(f"missing resource tree: {directory}")
        for name in UPSTREAM_TESTS:
            source.getmember(f"{RESOURCE_ROOT}/tests/{name}")
        native = lambda archive, prefix: {m.name[len(prefix):] for m in archive.getmembers()
            if m.isfile() and m.name.startswith(prefix) and m.name[len(prefix):].count("/") == 1
            and m.name.endswith("/SKILL.md")}
        old_skills = native(npm, "package/skills/")
        new_skills = native(source, f"{RESOURCE_ROOT}/skills/")
        if len(new_skills) != 83 or new_skills != old_skills:
            parser.error("native skill set drift: expected the same 83 npm skill bundles")
        out.mkdir(parents=True, mode=0o700)
        npm.extractall(out, filter="data")
        package = out / "package"
        for directory in RESOURCE_DIRS:
            shutil.rmtree(package / directory)
        # Extract only allowlisted resources; never import upstream host/model config.
        for member in members:
            parts = PurePosixPath(member.name).parts
            if len(parts) >= 2 and parts[1] in RESOURCE_DIRS:
                member.name = str(PurePosixPath("package", *parts[1:]))
                source.extract(member, out, filter="data")
        for name in UPSTREAM_TESTS:
            target = package / "upstream-tests" / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(source.extractfile(f"{RESOURCE_ROOT}/tests/{name}").read())
    for name in OVERLAY_FILES:
        target = out / "package" / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(here / "overlay" / name, target)
    shutil.copyfile(here / "standard-local.patch.yml", out / "standard-local.patch.yml")
    print(f"Verified npm {INTEGRITY}")
    print(f"Verified resource commit {RESOURCE_SHA}, archive sha256 {RESOURCE_SHA256}")
    print(f"Package: {out / 'package'}")
    print(f"Standard override (separate deployment patch): {out / 'standard-local.patch.yml'}")
    print("Next: set DSH_CHECKOUT to a built 0.2.0-rc.2 checkout and isolate HOME; run node --test tests/*.test.mjs.")
    print("Run python3 -B tests/helpers-offline.py with pytest installed; package with npm pack --ignore-scripts.")
    print("This script does not install or switch any profile.")


if __name__ == "__main__":
    main()
