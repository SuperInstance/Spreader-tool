"""Direct tests for the deterministic mock model backend."""

import time

import pytest

from spreader.mock_backend import MockCall, MockModelBackend


class TestDeterminism:
    def test_same_input_same_output(self):
        backend = MockModelBackend()
        r1 = backend.inference("hello", {"k": 1})
        r2 = backend.inference("hello", {"k": 1})
        assert r1 == r2

    def test_context_ordering_does_not_matter(self):
        backend = MockModelBackend()
        r1 = backend.inference("p", {"a": 1, "b": 2})
        r2 = backend.inference("p", {"b": 2, "a": 1})
        assert r1 == r2

    def test_different_prompt_different_hash(self):
        backend = MockModelBackend()
        # Statistical: with 3 labels and 3+ intents, collision across all
        # fields for two distinct prompts is vanishingly unlikely.
        r1 = backend.inference("alpha", {})
        r2 = backend.inference("beta", {})
        assert r1 != r2

    def test_label_in_valid_set(self):
        backend = MockModelBackend()
        for i in range(20):
            r = backend.inference(f"prompt-{i}", {})
            assert r["label"] in ("ham", "spam", "ambiguous")

    def test_confidence_in_range(self):
        backend = MockModelBackend()
        for i in range(20):
            r = backend.inference(f"prompt-{i}", {})
            assert 0.5 <= r["confidence"] <= 1.0

    def test_intent_in_valid_set(self):
        backend = MockModelBackend()
        intents = {"promotional", "phishing", "transactional", "personal", "newsletter"}
        for i in range(10):
            r = backend.inference(f"prompt-{i}", {})
            assert r["intent"] in intents


class TestCallRecording:
    def test_calls_recorded(self):
        backend = MockModelBackend()
        backend.inference("a", {})
        backend.inference("b", {})
        assert backend.call_count == 2
        assert [c.prompt for c in backend.calls] == ["a", "b"]

    def test_calls_returns_copy(self):
        backend = MockModelBackend()
        backend.inference("a", {})
        calls = backend.calls
        calls.clear()
        assert backend.call_count == 1

    def test_mockcall_fields(self):
        backend = MockModelBackend()
        r = backend.inference("p", {"_tier": "cheap"})
        call = backend.calls[0]
        assert isinstance(call, MockCall)
        assert call.prompt == "p"
        assert call.tier == "cheap"
        assert call.response == r
        assert call.latency_ms >= 0.0
        assert call.timestamp > 0

    def test_default_tier_is_full(self):
        backend = MockModelBackend()
        backend.inference("p", {})
        assert backend.calls[0].tier == "full"

    def test_reset_clears_calls(self):
        backend = MockModelBackend()
        backend.inference("a", {})
        backend.reset()
        assert backend.call_count == 0
        assert backend.calls == []

    def test_total_latency_ms(self):
        backend = MockModelBackend()
        backend.inference("a", {})
        backend.inference("b", {})
        total = backend.total_latency_ms()
        assert total >= 0.0
        assert abs(total - sum(c.latency_ms for c in backend.calls)) < 1e-6


class TestLatency:
    def test_base_latency_applied(self):
        backend = MockModelBackend(base_latency_ms=10)
        backend.inference("p", {})
        assert backend.calls[0].latency_ms >= 9.0  # allow clock slack

    def test_tier_latency_override(self):
        backend = MockModelBackend(
            base_latency_ms=5,
            tier_latencies={"cheap": 20},
        )
        backend.inference("p", {"_tier": "cheap"})
        backend.inference("p", {"_tier": "full"})
        latencies = [c.latency_ms for c in backend.calls]
        assert latencies[0] >= 18.0
        assert latencies[1] < latencies[0]

    def test_zero_latency_default_is_fast(self):
        backend = MockModelBackend()
        start = time.monotonic()
        for i in range(100):
            backend.inference(f"p{i}", {})
        assert time.monotonic() - start < 1.0


class TestErrorInjection:
    def test_error_rate_zero_never_errors(self):
        backend = MockModelBackend(error_rate=0.0, error_message="BOOM")
        for i in range(50):
            r = backend.inference(f"p{i}", {})
            assert "error" not in r

    def test_error_rate_one_always_errors(self):
        backend = MockModelBackend(error_rate=1.0, error_message="BOOM")
        for i in range(10):
            r = backend.inference(f"p{i}", {})
            assert r == {"error": "BOOM", "confidence": 0.0}

    def test_error_is_deterministic_per_input(self):
        backend = MockModelBackend(error_rate=0.3)
        for i in range(20):
            r1 = backend.inference(f"p{i}", {})
            r2 = backend.inference(f"p{i}", {})
            assert ("error" in r1) == ("error" in r2)

    def test_error_rate_distribution(self):
        # With error_rate=0.5, over many inputs roughly half should error.
        backend = MockModelBackend(error_rate=0.5)
        errors = sum(
            1
            for i in range(200)
            if "error" in backend.inference(f"p{i}", {})
        )
        assert 60 <= errors <= 140  # generous binomial bounds


class TestValidate:
    def test_error_response_scores_zero(self):
        backend = MockModelBackend()
        assert backend.validate({"error": "x", "confidence": 0.9}, None) == 0.0

    def test_no_expected_returns_confidence(self):
        backend = MockModelBackend()
        assert backend.validate({"label": "spam", "confidence": 0.8}, None) == 0.8

    def test_matching_label_boosted(self):
        backend = MockModelBackend()
        score = backend.validate(
            {"label": "spam", "confidence": 0.8}, {"label": "spam"}
        )
        assert score == pytest.approx(0.9)

    def test_boost_caps_at_one(self):
        backend = MockModelBackend()
        score = backend.validate(
            {"label": "spam", "confidence": 0.99}, {"label": "spam"}
        )
        assert score == 1.0

    def test_mismatching_label_halved(self):
        backend = MockModelBackend()
        score = backend.validate(
            {"label": "ham", "confidence": 0.8}, {"label": "spam"}
        )
        assert score == pytest.approx(0.4)

    def test_expected_without_label_is_noop(self):
        backend = MockModelBackend()
        score = backend.validate(
            {"label": "spam", "confidence": 0.7}, {"other": "x"}
        )
        assert score == 0.7

    def test_missing_confidence_defaults_to_zero(self):
        backend = MockModelBackend()
        assert backend.validate({"label": "spam"}, None) == 0.0
