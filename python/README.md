# crawlerdata (Python)

Google Search (SERP) data in Python: organic results, **AI Overview with its cited sources**, People Also Ask, News, Images, Local, Autocomplete and Google Shopping, through the [CrawlerData API](https://crawlerdata.com).

```bash
pip install crawlerdata
```

Create an API key at [app.crawlerdata.com](https://app.crawlerdata.com) (new accounts with a verified work email get 50 free credits). One request is one credit; failed requests are not charged.

```python
from crawlerdata import CrawlerData

cd = CrawlerData()                       # reads CRAWLERDATA_API_KEY, or CrawlerData(api_key="...")

result = cd.search("best crm software", country="us", device="mobile")
for r in result["organic_results"][:3]:
    print(r["position"], r["title"], r["link"])

overview = cd.ai_overview("what is a sitemap")      # {"text": ..., "sources": [...]} or None
if overview:
    print(overview["text"])
    print([s["link"] for s in overview["sources"]])

print(cd.news("openai")["news_results"][0]["title"])
print(cd.autocomplete("running sho")["suggestions"])
```

## Methods

| Method | Endpoint | Returns |
|---|---|---|
| `search(query, country="us", device=None, **params)` | google-search | organic results, ads, AI Overview, People Also Ask, local pack, top stories, related searches |
| `ai_overview(query, ...)` | google-search | the AI Overview (text + sources) or `None` |
| `news`, `images`, `local`, `autocomplete` | google-news, google-images, google-local, google-autocomplete | as named |
| `shopping_search`, `shopping_sellers(product_id)`, `shopping_product(product_id)` | google-shopping-* | products, every seller's price, product details |
| `run(endpoint, params)` | any | the full response: `{"job": {... "credits": 1}, "result": {...}}` |

Extra options (`language`, `location`, `page`, ...) are passed through as API params; see the [API reference](https://crawlerdata.com/apis/google-search-api).

Errors raise `CrawlerDataError` with `.status` and `.code` (for example 401 for a rejected key, 402 when out of credits). Network errors, 429 and 5xx are retried twice.

MIT licensed.
