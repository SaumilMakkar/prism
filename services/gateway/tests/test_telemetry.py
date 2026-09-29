from app.telemetry.telemetry import TelemetryWriter


def test_emit_writes_hash_linked_events(tmp_path):
    writer = TelemetryWriter(path=tmp_path / "events.jsonl")
    writer.emit("controller_decision", trace_id="t1", session_id_hash="h1", decision="retrieve")
    writer.emit("retrieval_completed", trace_id="t1", session_id_hash="h1", doc_ids=["KB_012 §2.1"])
    assert writer.verify() is True
    assert len(writer.read_all()) == 2


def test_tampering_is_detected(tmp_path):
    writer = TelemetryWriter(path=tmp_path / "events.jsonl")
    writer.emit("controller_decision", trace_id="t1", decision="wait")
    writer.emit("controller_decision", trace_id="t2", decision="retrieve")

    events = writer.read_all()
    events[0]["decision"] = "retrieve"  # tamper with an already-written line
    (tmp_path / "events.jsonl").write_text(
        "\n".join(__import__("json").dumps(e) for e in events) + "\n", encoding="utf-8"
    )

    from prism_core.hashchain import HashChain

    assert HashChain.verify(writer.read_all(), genesis=writer.chain.genesis) is False


def test_writer_restart_resumes_the_chain_instead_of_breaking_it(tmp_path):
    path = tmp_path / "events.jsonl"

    writer_a = TelemetryWriter(path=path)
    writer_a.emit("controller_decision", trace_id="t1", decision="wait")
    writer_a.emit("controller_decision", trace_id="t2", decision="retrieve")

    # Simulate a process restart against the same file.
    writer_b = TelemetryWriter(path=path)
    writer_b.emit("controller_decision", trace_id="t3", decision="wait")

    assert writer_b.verify() is True
    assert len(writer_b.read_all()) == 3


def test_raw_logging_false_strips_transcript_fields(tmp_path, monkeypatch):
    monkeypatch.setenv("RAW_LOGGING", "false")
    import importlib

    from app.telemetry import telemetry as telemetry_module

    importlib.reload(telemetry_module)
    writer = telemetry_module.TelemetryWriter(path=tmp_path / "events.jsonl")
    writer.emit("controller_decision", trace_id="t1", raw_text="my email is a@b.com")
    events = writer.read_all()
    assert "raw_text" not in events[0]
