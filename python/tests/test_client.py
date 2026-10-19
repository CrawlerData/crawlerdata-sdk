import pytest
import requests

from crawlerdata import CrawlerData, CrawlerDataError


class FakeResponse:
    def __init__(self, status=200, body=None):
        self.status_code = status
        self._body = body if body is not None else {}

    def json(self):
        return self._body


class FakeSession:
    def __init__(self, *responses):
        self.responses = list(responses)
        self.calls = []

    def post(self, url, json=None, headers=None, timeout=None):
        self.calls.append({"url": url, "json": json, "headers": headers, "timeout": timeout})
        r = self.responses.pop(0)
        if isinstance(r, Exception):
            raise r
        return r


OK = {"job": {"status": "completed", "credits": 1}, "result": {"organic_results": [{"title": "T"}]}}


@pytest.fixture(autouse=True)
def no_sleep(monkeypatch):
    monkeypatch.setattr("crawlerdata.client.time.sleep", lambda s: None)


def test_requires_a_key(monkeypatch):
    monkeypatch.delenv("CRAWLERDATA_API_KEY", raising=False)
    with pytest.raises(CrawlerDataError, match="No API key"):
        CrawlerData()


def test_reads_key_from_env_and_sends_a_live_job(monkeypatch):
    monkeypatch.setenv("CRAWLERDATA_API_KEY", "k_env")
    s = FakeSession(FakeResponse(200, OK))
    out = CrawlerData(session=s).search("best crm", device="mobile", language=None)
    assert out == OK["result"]
    call = s.calls[0]
    assert call["url"] == "https://api.crawlerdata.com/v1/jobs"
    assert call["headers"] == {"Authorization": "Bearer k_env"}
    assert call["json"] == {"endpoint": "google-search", "params": {"query": "best crm", "country": "us", "device": "mobile"}, "queue": "live"}


def test_none_params_are_dropped():
    s = FakeSession(FakeResponse(200, OK))
    CrawlerData("k", session=s).search("q")
    assert "device" not in s.calls[0]["json"]["params"]


def test_each_helper_uses_the_right_endpoint_and_param():
    cases = [
        (lambda c: c.news("n"), "google-news", {"query": "n", "country": "us"}),
        (lambda c: c.images("i"), "google-images", {"query": "i", "country": "us"}),
        (lambda c: c.local("l", country="gb"), "google-local", {"query": "l", "country": "gb"}),
        (lambda c: c.autocomplete("a"), "google-autocomplete", {"query": "a", "country": "us"}),
        (lambda c: c.shopping_search("s"), "google-shopping-search", {"query": "s", "country": "us"}),
        (lambda c: c.shopping_sellers("123"), "google-shopping-product", {"product_id": "123", "country": "us"}),
        (lambda c: c.shopping_product("123"), "google-shopping-product-info", {"product_id": "123", "country": "us"}),
    ]
    for call, endpoint, params in cases:
        s = FakeSession(FakeResponse(200, OK))
        call(CrawlerData("k", session=s))
        assert s.calls[0]["json"]["endpoint"] == endpoint
        assert s.calls[0]["json"]["params"] == params


def test_ai_overview_returns_text_and_sources_or_none():
    with_overview = {"job": {}, "result": {"ai_overview": {"text": "A sitemap is...", "sources": [{"title": "W", "link": "https://w"}]}}}
    without = {"job": {}, "result": {"organic_results": []}}
    assert CrawlerData("k", session=FakeSession(FakeResponse(200, with_overview))).ai_overview("q")["sources"][0]["link"] == "https://w"
    assert CrawlerData("k", session=FakeSession(FakeResponse(200, without))).ai_overview("q") is None


def test_api_errors_carry_status_and_code_and_are_not_retried():
    body = {"error": {"message": "Insufficient credits", "code": "INSUFFICIENT_CREDITS"}}
    s = FakeSession(FakeResponse(402, body))
    with pytest.raises(CrawlerDataError) as e:
        CrawlerData("k", session=s).search("q")
    assert (e.value.status, e.value.code) == (402, "INSUFFICIENT_CREDITS")
    assert "Insufficient credits" in str(e.value)
    assert len(s.calls) == 1


def test_retries_429_5xx_and_network_errors_then_succeeds():
    s = FakeSession(FakeResponse(503, {}), requests.ConnectionError("boom"), FakeResponse(200, OK))
    assert CrawlerData("k", session=s).search("q") == OK["result"]
    assert len(s.calls) == 3


def test_gives_up_after_max_retries():
    s = FakeSession(FakeResponse(502, {}), FakeResponse(502, {}), FakeResponse(502, {}))
    with pytest.raises(CrawlerDataError) as e:
        CrawlerData("k", session=s).search("q")
    assert e.value.status == 502 and len(s.calls) == 3


def test_many_runs_in_order():
    s = FakeSession(FakeResponse(200, OK), FakeResponse(200, OK))
    out = CrawlerData("k", session=s).many("google-search", ["a", "b"])
    assert len(out) == 2 and [c["json"]["params"]["query"] for c in s.calls] == ["a", "b"]
