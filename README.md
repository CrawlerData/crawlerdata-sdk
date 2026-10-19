# CrawlerData SDKs

Small clients for the [CrawlerData API](https://crawlerdata.com): Google Search (SERP) data, **AI Overview with cited sources**, People Also Ask, News, Images, Local, Autocomplete and Google Shopping, as JSON.

| Language | Install | Docs |
|---|---|---|
| Python | `pip install crawlerdata` | [python/](python/) |
| Node.js | `npm install crawlerdata` | [node/](node/) |

```python
from crawlerdata import CrawlerData
cd = CrawlerData()                      # CRAWLERDATA_API_KEY
print(cd.ai_overview("what is a sitemap"))
```

```js
import { CrawlerData } from 'crawlerdata';
const cd = new CrawlerData();
console.log(await cd.aiOverview('what is a sitemap'));
```

Get an API key at [app.crawlerdata.com](https://app.crawlerdata.com): new accounts with a verified work email get 50 free credits, and one request is one credit. Failed requests are not charged. More examples (curl, n8n, Open WebUI, Dify): [crawlerdata-examples](https://github.com/CrawlerData/crawlerdata-examples).

MIT licensed.
