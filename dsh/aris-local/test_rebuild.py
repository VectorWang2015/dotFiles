#!/usr/bin/env python3
"""Offline stdlib-only tests for rebuild archive preflight and write refusal."""
import io
from pathlib import Path
import subprocess
import sys
import tarfile
import tempfile
import unittest

import rebuild


class RebuildTests(unittest.TestCase):
    def archive(self, names, link=False):
        data = io.BytesIO()
        with tarfile.open(fileobj=data, mode="w") as archive:
            for name in names:
                member = tarfile.TarInfo(name)
                if link:
                    member.type = tarfile.SYMTYPE
                    member.linkname = "/etc/passwd"
                archive.addfile(member)
        data.seek(0)
        return tarfile.open(fileobj=data)

    def test_regular_archive_accepted(self):
        with self.archive(["package/package.json", "package/skills/a/SKILL.md"]) as archive:
            rebuild.preflight(archive, "package")

    def test_traversal_rejected(self):
        with self.archive(["package/../escape"]) as archive:
            with self.assertRaises(ValueError):
                rebuild.preflight(archive, "package")

    def test_absolute_rejected(self):
        with self.archive(["/package/escape"]) as archive:
            with self.assertRaises(ValueError):
                rebuild.preflight(archive, "package")

    def test_link_rejected(self):
        with self.archive(["package/link"], link=True) as archive:
            with self.assertRaises(ValueError):
                rebuild.preflight(archive, "package")

    def test_duplicate_rejected(self):
        with self.archive(["package/x", "package/x"]) as archive:
            with self.assertRaises(ValueError):
                rebuild.preflight(archive, "package")

    def test_wrong_root_rejected(self):
        with self.archive(["other/file"]) as archive:
            with self.assertRaises(ValueError):
                rebuild.preflight(archive, "package")

    def test_existing_destination_refused_before_network(self):
        with tempfile.TemporaryDirectory(prefix="aris-rebuild-", dir="/tmp") as temporary:
            result = subprocess.run([sys.executable, "-B", str(Path(rebuild.__file__)),
                                     "--out", temporary], capture_output=True, text=True,
                                    env={"HOME": temporary}, timeout=10)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("refusing existing destination", result.stderr)
            self.assertEqual(list(Path(temporary).iterdir()), [])

    def test_bad_npm_digest_refused_before_resource_download(self):
        with tempfile.TemporaryDirectory(prefix="aris-rebuild-", dir="/tmp") as temporary:
            archive = Path(temporary) / "invalid.tgz"
            archive.write_bytes(b"not the pinned package")
            out = Path(temporary) / "out"
            result = subprocess.run([sys.executable, "-B", str(Path(rebuild.__file__)),
                                     "--out", str(out), "--archive", str(archive)],
                                    capture_output=True, text=True, env={"HOME": temporary}, timeout=10)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("npm archive integrity mismatch", result.stderr)
            self.assertFalse(out.exists())


if __name__ == "__main__":
    unittest.main()
