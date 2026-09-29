import pytest

from app.replay.replay import ReplayingProvider, ReplayMissError, request_hash


def test_replay_missing_trajectory_raises_loudly(tmp_path):
    provider = ReplayingProvider(provider=None, mode="replay", trajectories_dir=tmp_path)
    with pytest.raises(ReplayMissError):
        provider.complete("system", "user", "model")


def test_record_then_replay_round_trips(tmp_path):
    class FakeProvider:
        def complete(self, system, user, model):
            return "the answer"

    recorder = ReplayingProvider(provider=FakeProvider(), mode="record", trajectories_dir=tmp_path / "t")
    response, source = recorder.complete("sys", "usr", "model-x")
    assert response == "the answer"
    assert source == "record"

    replayer = ReplayingProvider(provider=None, mode="replay", trajectories_dir=tmp_path / "t")
    replayed, replay_source = replayer.complete("sys", "usr", "model-x")
    assert replayed == "the answer"
    assert replay_source == "replay"


def test_offline_mode_records_and_tags_source(tmp_path):
    class FakeOfflineProvider:
        def complete(self, system, user, model):
            return '{"sub_queries": ["q1"]}'

    offline = ReplayingProvider(provider=FakeOfflineProvider(), mode="offline", trajectories_dir=tmp_path)
    response, source = offline.complete("sys", "usr", "model-x")
    assert source == "offline"

    saved = tmp_path / f"{request_hash('sys', 'usr', 'model-x')}.json"
    assert saved.exists()

    replayer = ReplayingProvider(provider=None, mode="replay", trajectories_dir=tmp_path)
    replayed, replay_source = replayer.complete("sys", "usr", "model-x")
    assert replayed == response
    assert replay_source == "replay"


def test_request_hash_is_stable_for_same_inputs():
    assert request_hash("a", "b", "c") == request_hash("a", "b", "c")
    assert request_hash("a", "b", "c") != request_hash("a", "b", "d")


def test_env_var_selects_the_directory(tmp_path, monkeypatch):
    monkeypatch.setenv("TRAJECTORIES_DIR", str(tmp_path / "from-env"))
    provider = ReplayingProvider(provider=None, mode="replay")
    assert provider.trajectories_dir == tmp_path / "from-env"
    assert not provider.trajectories_dir.exists()  # replay never creates it


def test_record_creates_the_directory_on_first_write(tmp_path):
    class FakeProvider:
        def complete(self, system, user, model):
            return "x"

    target = tmp_path / "nested" / "dir"
    ReplayingProvider(provider=FakeProvider(), mode="record", trajectories_dir=target).complete("s", "u", "m")
    assert any(target.glob("*.json"))
