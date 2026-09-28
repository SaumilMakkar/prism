import pytest

from app.replay.replay import ReplayingProvider, ReplayMissError, request_hash


def test_replay_missing_trajectory_raises_loudly(tmp_path, monkeypatch):
    monkeypatch.setenv("TRAJECTORIES_DIR", str(tmp_path))
    provider = ReplayingProvider(provider=None, mode="replay")
    provider._trajectory_path = lambda key: tmp_path / f"{key}.json"
    with pytest.raises(ReplayMissError):
        provider.complete("system", "user", "model")


def test_record_then_replay_round_trips(tmp_path):
    class FakeProvider:
        def complete(self, system, user, model):
            return "the answer"

    recorder = ReplayingProvider(provider=FakeProvider(), mode="record")
    recorder._trajectory_path = lambda key: tmp_path / f"{key}.json"
    response, source = recorder.complete("sys", "usr", "model-x")
    assert response == "the answer"
    assert source == "record"

    replayer = ReplayingProvider(provider=None, mode="replay")
    replayer._trajectory_path = lambda key: tmp_path / f"{key}.json"
    replayed, replay_source = replayer.complete("sys", "usr", "model-x")
    assert replayed == "the answer"
    assert replay_source == "replay"


def test_offline_mode_records_and_tags_source(tmp_path):
    class FakeOfflineProvider:
        def complete(self, system, user, model):
            return '{"sub_queries": ["q1"]}'

    offline = ReplayingProvider(provider=FakeOfflineProvider(), mode="offline")
    offline._trajectory_path = lambda key: tmp_path / f"{key}.json"
    response, source = offline.complete("sys", "usr", "model-x")
    assert source == "offline"

    saved = tmp_path / f"{request_hash('sys', 'usr', 'model-x')}.json"
    assert saved.exists()

    replayer = ReplayingProvider(provider=None, mode="replay")
    replayer._trajectory_path = lambda key: tmp_path / f"{key}.json"
    replayed, replay_source = replayer.complete("sys", "usr", "model-x")
    assert replayed == response
    assert replay_source == "replay"


def test_request_hash_is_stable_for_same_inputs():
    assert request_hash("a", "b", "c") == request_hash("a", "b", "c")
    assert request_hash("a", "b", "c") != request_hash("a", "b", "d")
