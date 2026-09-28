import pytest

from app.cost.cost import CostCeilingExceeded, CostMeter


def test_charge_accumulates_per_session():
    meter = CostMeter(per_session_ceiling_usd=1.0)
    meter.charge("s1", input_tokens=1000, output_tokens=1000)
    assert meter.session_total("s1") > 0


def test_charge_raises_past_ceiling():
    meter = CostMeter(per_session_ceiling_usd=0.001)
    with pytest.raises(CostCeilingExceeded):
        meter.charge("s1", input_tokens=100000, output_tokens=100000)


def test_sessions_are_independent():
    meter = CostMeter(per_session_ceiling_usd=1.0)
    meter.charge("s1", input_tokens=1000, output_tokens=1000)
    meter.charge("s2", input_tokens=1000, output_tokens=1000)
    assert meter.session_total("s1") == meter.session_total("s2")
