from app.nli.nli import LexicalEntailmentHeuristic


def test_entails_when_hypothesis_terms_present_in_premise():
    nli = LexicalEntailmentHeuristic()
    premise = "connect the original charger and cable and wait 10 minutes before power on"
    hypothesis = "wait 10 minutes before attempting to power on the device"
    assert nli.entails(premise, hypothesis) is True


def test_does_not_entail_unrelated_hypothesis():
    nli = LexicalEntailmentHeuristic()
    premise = "SmartThings pairing requires a 2.4GHz network"
    hypothesis = "the warranty period is 24 months for registered devices"
    assert nli.entails(premise, hypothesis) is False


def test_empty_hypothesis_never_entailed():
    nli = LexicalEntailmentHeuristic()
    assert nli.entails("some premise text here", "") is False
