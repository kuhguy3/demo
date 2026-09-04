import math

from football_intel.data.sample_fixtures import FIXTURES
from football_intel.dashboard import render_dashboard
from football_intel.engine import PredictionEngine, VALUE_EDGE_THRESHOLD
from football_intel.picks import MIN_PICK_CONFIDENCE, top_picks


def _predictions():
    engine = PredictionEngine()
    return [engine.predict(fx) for fx in FIXTURES]


def test_outcome_probabilities_sum_to_100():
    for pred in _predictions():
        total = pred.home_win_pct + pred.draw_pct + pred.away_win_pct
        assert total == 100


def test_confidence_within_scale():
    for pred in _predictions():
        assert 1 <= pred.confidence <= 10


def test_elite_confidence_requires_agreement():
    for pred in _predictions():
        if pred.confidence >= 9:
            picks = [max(range(3), key=lambda i: probs[i]) for probs in pred.model_outcomes.values()]
            majority = max(set(picks), key=picks.count)
            assert picks.count(majority) == 4, "9+ confidence must come from full model agreement"


def test_value_bets_only_flagged_above_threshold():
    for pred in _predictions():
        for vb in pred.value_bets:
            assert vb.edge / 100 > VALUE_EDGE_THRESHOLD - 1e-9
            assert vb.label != "No Value"


def test_consensus_index_bounded():
    for pred in _predictions():
        assert 0 <= pred.consensus.score <= 100
        assert pred.consensus.interpretation in {"Avoid", "Lean", "Strong", "Elite Opportunity"}


def test_elite_opportunity_requires_full_agreement():
    for pred in _predictions():
        if pred.consensus.interpretation == "Elite Opportunity":
            assert pred.consensus.agreement is True


def test_goals_markets_consistent():
    for pred in _predictions():
        assert math.isclose(pred.goals.btts_yes + pred.goals.btts_no, 100.0, abs_tol=0.2)
        assert pred.goals.over_1_5 >= pred.goals.over_2_5 >= pred.goals.over_3_5


def test_correct_scores_ranked_descending():
    for pred in _predictions():
        probs = [p for _s, p in pred.correct_scores]
        assert probs == sorted(probs, reverse=True)
        assert len(pred.correct_scores) == 3


def test_top_picks_respects_confidence_floor():
    predictions = _predictions()
    picks = top_picks(predictions)
    assert len(picks) <= 5
    for pick in picks:
        assert pick.confidence >= MIN_PICK_CONFIDENCE


def test_dashboard_renders_disclaimer_and_all_leagues():
    html_out = render_dashboard(_predictions())
    assert "should not be considered financial or betting advice" in html_out
    for fx in FIXTURES:
        assert fx.home.name in html_out
        assert fx.away.name in html_out


def test_no_randomness_between_runs():
    first = [(p.home_win_pct, p.draw_pct, p.away_win_pct, p.confidence) for p in _predictions()]
    second = [(p.home_win_pct, p.draw_pct, p.away_win_pct, p.confidence) for p in _predictions()]
    assert first == second
