"""Test the DSH-only launcher without starting terminals, servers, or user tools."""
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / 'start_workspace_on_boot.sh'


class LauncherTests(unittest.TestCase):
    def run_launcher(self, occupied=False, existing=True, repo=True):
        with tempfile.TemporaryDirectory(prefix='dsh-launcher-test-') as tmp:
            root = Path(tmp)
            home = root / 'home'
            bin_dir = root / 'bin'
            home.mkdir()
            bin_dir.mkdir()
            if repo:
                (home / 'Workspace/deepseek-harness-0.2.0-rc.2').mkdir(parents=True)
            log = root / 'calls'
            (bin_dir / 'ss').write_text('#!/bin/bash\nif [[ "$OCCUPIED" == 1 ]]; then echo LISTEN; fi\nexit 0\n')
            (bin_dir / 'tmux').write_text('''#!/bin/bash
printf '%s\\n' "$*" >> "$CALL_LOG"
case "$1" in
list-sessions) if [[ "$EXISTING" == 1 ]]; then echo '$1 1-workspace'; fi ;;
new-session) echo '$2' ;;
new-window) echo '@2' ;;
esac
exit 0
''')
            for path in bin_dir.iterdir():
                path.chmod(0o700)
            env = {**os.environ, 'HOME': str(home), 'PATH': str(bin_dir) + os.pathsep + os.environ['PATH'],
                   'OCCUPIED': str(int(occupied)), 'EXISTING': str(int(existing)), 'CALL_LOG': str(log)}
            result = subprocess.run(['/bin/bash', str(SCRIPT), '--dsh-only'], env=env, capture_output=True, text=True, timeout=5)
            calls = log.read_text() if log.exists() else ''
            return result, calls

    def test_dsh_only_uses_selected_checkout_without_labor_or_attach(self):
        result, calls = self.run_launcher()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('deepseek-harness-0.2.0-rc.2', calls)
        self.assertIn('pnpm dsh web --port 3080', calls)
        for forbidden in ['task next', 'attach', 'run-shell', 'WARN']:
            self.assertNotIn(forbidden, calls)

    def test_occupied_port_never_starts_another_instance(self):
        result, calls = self.run_launcher(occupied=True)
        self.assertEqual(result.returncode, 0)
        self.assertNotIn('new-window', calls)
        self.assertNotIn('send-keys', calls)

    def test_missing_workspace_creates_container_but_no_unrelated_tasks(self):
        result, calls = self.run_launcher(existing=False)
        self.assertEqual(result.returncode, 0)
        self.assertIn('new-session', calls)
        self.assertIn('new-window', calls)
        self.assertNotIn('task next', calls)
        self.assertNotIn('attach', calls)

    def test_missing_checkout_fails_before_server_start(self):
        result, calls = self.run_launcher(repo=False)
        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn('new-window', calls)


if __name__ == '__main__':
    unittest.main()
