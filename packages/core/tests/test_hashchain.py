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
