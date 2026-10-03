#!/usr/bin/env python3
"""Run the pinned helper tests with fail-closed network/process guards.

Use an already installed pytest. No dependency installation, installer execution,
model calls, real watchdog services or inherited credential environment.
"""
import os
from pathlib import Path
import sys
import tempfile

# Clear the inherited environment before importing test modules or pytest.
# Interpreter/module paths are already established; no PATH lookup is needed.
os.environ.clear()
os.environ.update(PYTEST_DISABLE_PLUGIN_AUTOLOAD="1", PYTHONDONTWRITEBYTECODE="1")
sys.dont_write_bytecode = True


def guard(event, args):
    if (event.startswith("socket.") or event in
            {"subprocess.Popen", "os.system", "os.exec", "os.posix_spawn", "os.spawn"}):
        raise AssertionError(f"offline helper suite blocked side effect: {event}")


sys.addaudithook(guard)
root = Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix="aris-helpers-", dir="/tmp") as temporary:
    home = Path(temporary) / "home"
    home.mkdir()
    os.environ.update(HOME=str(home), USERPROFILE=str(home), TMPDIR=temporary,
                      XDG_CONFIG_HOME=str(home / "config"), XDG_CACHE_HOME=str(home / "cache"),
                      CODEX_HOME=str(home / "codex"), CODEX_BIN="/nonexistent/do-not-call-codex")
    tempfile.tempdir = temporary
    import pytest
    status = pytest.main(["-q", "-p", "no:cacheprovider", "--confcutdir", str(root),
                          str(root / "upstream-tests")])
raise SystemExit(status)
