# crawlerdata (Node.js)

Google Search (SERP) data in JavaScript: organic results, **AI Overview with its cited sources**, People Also Ask, News, Images, Local, Autocomplete and Google Shopping, through the [CrawlerData API](https://crawlerdata.com). Zero dependencies, Node 18+, TypeScript types included.

```bash
npm install https://github.com/CrawlerData/crawlerdata-sdk/releases/download/v0.1.0/crawlerdata-0.1.0.tgz
```

(npm publishing is coming; this installs the same package from the GitHub release.)

Create an API key at [app.crawlerdata.com](https://app.crawlerdata.com) (new accounts with a verified work email get 50 free credits). One request is one credit; failed requests are not charged.

```js
import { CrawlerData } from 'crawlerdata';

const cd = new CrawlerData();                  // reads CRAWLERDATA_API_KEY, or new CrawlerData({ apiKey })

const result = await cd.search('best crm software', { country: 'us', device: 'mobile' });
for (const r of result.organic_results.slice(0, 3)) console.log(r.position, r.title, r.link);

const overview = await cd.aiOverview('what is a sitemap');   // { text, sources } or null
if (overview) console.log(overview.text, overview.sources.map((s) => s.link));

console.log((await cd.news('openai')).news_results[0].title);
console.log((await cd.autocomplete('running sho')).suggestions);
```

## Methods

`search`, `aiOverview`, `news`, `images`, `local`, `autocomplete`, `shoppingSearch`, `shoppingSellers(productId)`, `shoppingProduct(productId)`, and `run(endpoint, params)` for the full response (`{ job: { credits, ... }, result }`). Extra options (`language`, `location`, `page`, ...) are passed through as API params; see the [API reference](https://crawlerdata.com/apis/google-search-api).

Errors throw `CrawlerDataError` with `.status` and `.code` (for example 401 for a rejected key, 402 when out of credits). Network errors, 429 and 5xx are retried twice.

MIT licensed.
