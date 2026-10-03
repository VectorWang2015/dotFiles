"""Local regression checks for pinned changes; never call a model or network."""
import importlib.util
import json
import multiprocessing
from pathlib import Path
import sys

import pytest

ROOT = Path(__file__).resolve().parents[1]


def module(name):
    # Reuse the module imported by upstream tests so mock.patch targets agree.
    if name in sys.modules:
        return sys.modules[name]
    spec = importlib.util.spec_from_file_location(name, ROOT / "tools" / f"{name}.py")
    result = importlib.util.module_from_spec(spec)
    sys.modules[name] = result
    spec.loader.exec_module(result)
    return result


@pytest.mark.parametrize("name", ["auto-paper-improvement-loop", "overleaf-sync", "paper-claim-audit", "paper-plan", "resubmit-pipeline"])
def test_orchestrating_native_skills_keep_skill_grant(name):
    text = (ROOT / "skills" / name / "SKILL.md").read_text()
    grant = next(line for line in text.splitlines() if line.startswith("allowed-tools:"))
    assert "Skill" in [part.strip() for part in grant.split(":", 1)[1].split(",")]


@pytest.mark.parametrize("name", ["alphaxiv", "skills-codex/alphaxiv"])
def test_alphaxiv_canonical_markdown_urls(name):
    text = (ROOT / "skills" / name / "SKILL.md").read_text()
    assert "https://www.alphaxiv.org/overview/{PAPER_ID}.md" in text
    assert "https://www.alphaxiv.org/abs/{PAPER_ID}.md" in text


@pytest.mark.parametrize("name", ["arxiv_fetch", "research_wiki", "verify_papers"])
def test_arxiv_helpers_do_not_use_plain_http_endpoint(name):
    text = (ROOT / "tools" / f"{name}.py").read_text()
    assert "http://export.arxiv.org/api/query" not in text
    assert "https://export.arxiv.org/api/query" in text


def test_native_bundle_count_is_83():
    assert len(list((ROOT / "skills").glob("*/SKILL.md"))) == 83


def test_watchdog_cross_process_registration_has_no_lost_updates(tmp_path):
    watchdog = module("watchdog")
    assert watchdog.fcntl is not None, "this regression targets Linux flock"
    # Fork test workers only, never start the watchdog loop or external processes.
    context = multiprocessing.get_context("fork")
    workers = [context.Process(target=watchdog.register_task, args=(str(tmp_path), json.dumps(
        {"name": f"t{i}", "type": "training", "session": f"s{i}"}))) for i in range(24)]
    try:
        for process in workers:
            process.start()
        for process in workers:
            process.join(timeout=10)
            assert process.exitcode == 0
        tasks = json.loads((tmp_path / "tasks.json").read_text())
        assert {task["name"] for task in tasks} == {f"t{i}" for i in range(24)}
        assert (tmp_path / ".tasks.lock").is_file()
    finally:
        for process in workers:
            if process.is_alive():
                process.terminate()
                process.join()


def test_watchdog_lock_released_after_exception(tmp_path):
    watchdog = module("watchdog")
    paths = watchdog.get_paths(tmp_path)
    with pytest.raises(RuntimeError):
        with watchdog.tasks_lock(paths):
            raise RuntimeError("simulated failure")
    with open(tmp_path / ".tasks.lock", "w") as handle:
        watchdog.fcntl.flock(handle, watchdog.fcntl.LOCK_EX | watchdog.fcntl.LOCK_NB)
