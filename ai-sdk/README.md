# crawlerdata-ai-sdk

[Vercel AI SDK](https://ai-sdk.dev) tools for **Google Search (SERP)**: live results with **Google's AI Overview and the pages it cites**, News, Images, Local and Autocomplete, through the [CrawlerData API](https://crawlerdata.com).

Give a model `crawlerdataSearch` and it can look things up on Google while it works: current facts, recent events, what Google's AI Overview says and which sources it cites.

## Install

```bash
npm install crawlerdata-ai-sdk ai zod
```

Works with AI SDK v5, v6 and v7. Create an API key at [app.crawlerdata.com](https://app.crawlerdata.com) (new accounts with a verified work email get 50 free credits) and set it:

```bash
export CRAWLERDATA_API_KEY=your_key
```

## Use

```ts
import { generateText, isStepCount } from 'ai';
import { crawlerdataSearch } from 'crawlerdata-ai-sdk';

const { text } = await generateText({
  model: 'openai/gpt-5-mini',
  prompt: 'Does Google show an AI Overview for "what is a sitemap"? Which sources does it cite?',
  tools: { crawlerdataSearch: crawlerdataSearch() },
  stopWhen: isStepCount(3),
});

console.log(text);
```

Use all five tools at once:

```ts
import { crawlerdataTools } from 'crawlerdata-ai-sdk';

const result = await generateText({ model, prompt, tools: crawlerdataTools({ country: 'gb' }), stopWhen: isStepCount(5) });
```

## Tools

| Tool | What the model gets |
|---|---|
| `crawlerdataSearch` | Top organic results (`position`, `title`, `link`, `snippet`), Google's AI Overview (`text` and `sources`) when Google shows one, and related questions. Optional `country`, `language`, `device` (desktop or mobile), `location` (city level). |
| `crawlerdataNews` | Recent articles: title, source, date, link, snippet. |
| `crawlerdataImages` | Image URL, title and source page. |
| `crawlerdataLocal` | Businesses: name, rating, reviews, category, address, phone, website. |
| `crawlerdataAutocomplete` | Search suggestions for a partial query. |

Each tool takes the same options object:

| Option | Default | |
|---|---|---|
| `apiKey` | `process.env.CRAWLERDATA_API_KEY` | Your CrawlerData API key. |
| `country` | `us` | Default two-letter country code; the model can override it per call. |
| `language` | none | Default two-letter language code. |
| `maxResults` | `8` | Maximum results returned to the model per call (keeps token use down). |
| `timeoutMs` | `150000` | A live search loads a real Google page, so it can take a minute or more. |

Errors (missing or invalid key, out of credits, network) are thrown with a readable message, which the AI SDK passes to the model as a tool error.

## Cost

Each tool call is one CrawlerData request: 1 credit. Failed requests are not charged. Credit packs are prepaid with no subscription: [crawlerdata.com/pricing](https://crawlerdata.com/pricing).

## Links

- Guide: https://crawlerdata.com/integrations/vercel-ai-sdk
- API docs: https://app.crawlerdata.com/docs
- Other clients (Python, Node.js) in this repository: [`python/`](../python), [`node/`](../node)

MIT licensed.
