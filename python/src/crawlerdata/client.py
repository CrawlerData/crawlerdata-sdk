"""Small client for the CrawlerData API (https://crawlerdata.com). One request = one credit; failed requests are not charged."""
from __future__ import annotations

import os
import time
from typing import Any, Dict, List, Optional

import requests

DEFAULT_BASE_URL = "https://api.crawlerdata.com"
_RETRY_STATUS = {429, 500, 502, 503, 504}


class CrawlerDataError(Exception):
    """The API refused or failed a request. `status` is the HTTP status (None for network errors), `code` the API error code."""

    def __init__(self, message: str, status: Optional[int] = None, code: Optional[str] = None, details: Any = None):
        super().__init__(message)
        self.message = message
        self.status = status
        self.code = code
        self.details = details

    def __str__(self) -> str:
        bits = [self.message]
        if self.status:
            bits.append(f"(HTTP {self.status}{', ' + self.code if self.code else ''})")
        return " ".join(bits)


class CrawlerData:
    """Client. Create an API key at https://app.crawlerdata.com (new accounts with a verified work email get 50 free credits)."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        *,
        base_url: str = DEFAULT_BASE_URL,
        timeout: float = 200,
        max_retries: int = 2,
        session: Optional[requests.Session] = None,
    ):
        self.api_key = api_key or os.environ.get("CRAWLERDATA_API_KEY")
        if not self.api_key:
            raise CrawlerDataError("No API key: pass api_key=... or set CRAWLERDATA_API_KEY (create one at https://app.crawlerdata.com).")
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.max_retries = max_retries
        self._session = session or requests.Session()

    # -- core -----------------------------------------------------------------------------------------
    def run(self, endpoint: str, params: Dict[str, Any], *, queue: str = "live") -> Dict[str, Any]:
        """Run one request and return the full response: {"job": {...status, credits...}, "result": {...}}."""
        body = {"endpoint": endpoint, "params": {k: v for k, v in params.items() if v is not None}, "queue": queue}
        last: Optional[CrawlerDataError] = None
        for attempt in range(self.max_retries + 1):
            try:
                res = self._session.post(
                    f"{self.base_url}/v1/jobs",
                    json=body,
                    headers={"Authorization": f"Bearer {self.api_key}"},
                    timeout=self.timeout,
                )
            except requests.RequestException as e:
                last = CrawlerDataError(f"Could not reach CrawlerData: {e}")
            else:
                if res.status_code < 400:
                    return res.json()
                last = self._error(res)
                if res.status_code not in _RETRY_STATUS:
                    raise last
            if attempt < self.max_retries:
                time.sleep(1.5 * (attempt + 1))
        assert last is not None
        raise last

    @staticmethod
    def _error(res: requests.Response) -> CrawlerDataError:
        try:
            err = (res.json() or {}).get("error") or {}
        except ValueError:
            err = {}
        return CrawlerDataError(err.get("message") or f"HTTP {res.status_code}", res.status_code, err.get("code"), err.get("details"))

    def _result(self, endpoint: str, params: Dict[str, Any]) -> Dict[str, Any]:
        return self.run(endpoint, params).get("result") or {}

    # -- Google Search ----------------------------------------------------------------------------------
    def search(self, query: str, *, country: str = "us", device: Optional[str] = None, **params: Any) -> Dict[str, Any]:
        """Google Search: organic_results, ads, ai_overview, people_also_ask, local_pack, top_stories, related_searches...
        Extra options (language, location, page, ...) are passed through as API params."""
        return self._result("google-search", {"query": query, "country": country, "device": device, **params})

    def ai_overview(self, query: str, *, country: str = "us", device: Optional[str] = None, **params: Any) -> Optional[Dict[str, Any]]:
        """The AI Overview for a search as {"text": ..., "sources": [{"title", "link"}]}, or None when Google shows none."""
        overview = self.search(query, country=country, device=device, **params).get("ai_overview")
        return overview if isinstance(overview, dict) and overview.get("text") else None

    def news(self, query: str, *, country: str = "us", **params: Any) -> Dict[str, Any]:
        """Google News: news_results with title, source, date, snippet, link."""
        return self._result("google-news", {"query": query, "country": country, **params})

    def images(self, query: str, *, country: str = "us", **params: Any) -> Dict[str, Any]:
        """Google Images: up to 100 images per request."""
        return self._result("google-images", {"query": query, "country": country, **params})

    def local(self, query: str, *, country: str = "us", **params: Any) -> Dict[str, Any]:
        """Google Local: businesses with rating, reviews, address, phone, hours."""
        return self._result("google-local", {"query": query, "country": country, **params})

    def autocomplete(self, query: str, *, country: str = "us", **params: Any) -> Dict[str, Any]:
        """Google Autocomplete suggestions for a partial query."""
        return self._result("google-autocomplete", {"query": query, "country": country, **params})

    # -- Google Shopping --------------------------------------------------------------------------------
    def shopping_search(self, query: str, *, country: str = "us", **params: Any) -> Dict[str, Any]:
        """Google Shopping search: products with price, merchant, rating and product_id."""
        return self._result("google-shopping-search", {"query": query, "country": country, **params})

    def shopping_sellers(self, product_id: str, *, country: str = "us", **params: Any) -> Dict[str, Any]:
        """Every seller for a product, sorted by total price (1 credit per 10 sellers)."""
        return self._result("google-shopping-product", {"product_id": product_id, "country": country, **params})

    def shopping_product(self, product_id: str, *, country: str = "us", **params: Any) -> Dict[str, Any]:
        """Product details: title, brand, description, specs, images, rating."""
        return self._result("google-shopping-product-info", {"product_id": product_id, "country": country, **params})

    def many(self, endpoint: str, queries: List[str], *, country: str = "us", **params: Any) -> List[Dict[str, Any]]:
        """Run one endpoint for several queries, one after another; returns the list of results in order."""
        return [self._result(endpoint, {"query": q, "country": country, **params}) for q in queries]
