from prism_core.hashchain import HashChain


def test_chain_links_successive_events():
    chain = HashChain()
    e1 = chain.append({"event": "a"})
    e2 = chain.append({"event": "b"})
    assert e2["prev_hash"] == e1["hash"]
    assert e1["prev_hash"] == chain.genesis


def test_verify_accepts_untampered_chain():
    chain = HashChain()
    events = [chain.append({"event": "a", "n": i}) for i in range(5)]
    assert HashChain.verify(events, genesis=chain.genesis) is True


def test_verify_rejects_tampered_event():
    chain = HashChain()
    events = [chain.append({"event": "a", "n": i}) for i in range(3)]
    tampered = dict(events[1])
    tampered["n"] = 999
    events[1] = tampered
    assert HashChain.verify(events, genesis=chain.genesis) is False


def test_verify_rejects_reordered_events():
    chain = HashChain()
    events = [chain.append({"event": "a", "n": i}) for i in range(3)]
    reordered = [events[0], events[2], events[1]]
    assert HashChain.verify(reordered, genesis=chain.genesis) is False


def test_resume_lets_a_second_writer_extend_the_same_file_validly():
    writer_a = HashChain()
    written = [writer_a.append({"event": "a", "n": i}) for i in range(2)]

    # Simulate a process restart: a fresh HashChain with its own genesis...
    writer_b = HashChain()
    # ...resumes from the existing file's tip instead of appending as if
    # this were a brand new chain.
    writer_b.resume(written[-1]["hash"])
    written.append(writer_b.append({"event": "b", "n": 2}))

    assert HashChain.verify(written, genesis=writer_a.genesis) is True


def test_without_resume_a_restarted_writer_breaks_the_chain():
    writer_a = HashChain()
    written = [writer_a.append({"event": "a", "n": i}) for i in range(2)]

    writer_b = HashChain()  # fresh genesis, no resume() call
    written.append(writer_b.append({"event": "b", "n": 2}))

    assert HashChain.verify(written, genesis=writer_a.genesis) is False
