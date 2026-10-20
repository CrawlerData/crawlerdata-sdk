// CrawlerData tools for the Vercel AI SDK: Google Search (with AI Overview), News, Images, Local and
// Autocomplete as tools a model can call. https://crawlerdata.com
import { tool } from 'ai';
import { z } from 'zod';

const DEFAULT_BASE_URL = 'https://api.crawlerdata.com';
const DEFAULT_MAX_RESULTS = 8;
const KEY_HELP = 'Create one at https://app.crawlerdata.com (new accounts with a verified work email get 50 free credits).';

export interface CrawlerDataToolOptions {
  /** CrawlerData API key. Defaults to the CRAWLERDATA_API_KEY environment variable. */
  apiKey?: string;
  /** Default two-letter country code for results (the model can override it per call). Default: us. */
  country?: string;
  /** Default two-letter language code. */
  language?: string;
  /** Maximum number of results returned to the model per call. Default: 8. */
  maxResults?: number;
  /** Request timeout in milliseconds. A live search loads a real Google page, so keep it generous. Default: 150000. */
  timeoutMs?: number;
  /** API base URL (for tests or proxies). Default: https://api.crawlerdata.com */
  baseUrl?: string;
  /** Custom fetch implementation (for tests). */
  fetch?: typeof fetch;
}

type Params = Record<string, string | number | undefined>;

async function run(options: CrawlerDataToolOptions, endpoint: string, params: Params): Promise<Record<string, any>> {
  const apiKey = options.apiKey ?? process.env.CRAWLERDATA_API_KEY;
  if (!apiKey) throw new Error(`CrawlerData API key missing: pass { apiKey } or set CRAWLERDATA_API_KEY. ${KEY_HELP}`);
  const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''));
  const doFetch = options.fetch ?? globalThis.fetch;
  let res: Response;
  try {
    res = await doFetch(`${(options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '')}/v1/jobs`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint, params: clean, queue: 'live' }),
      signal: AbortSignal.timeout(options.timeoutMs ?? 150_000),
    });
  } catch (e) {
    throw new Error(`Could not reach CrawlerData: ${(e as Error).message}`);
  }
  if (!res.ok) {
    const err = ((await res.json().catch(() => ({}))) as any)?.error ?? {};
    const hint = res.status === 401 ? ' Check the API key.' : res.status === 402 ? ' The account is out of credits: https://app.crawlerdata.com' : '';
    throw new Error(`CrawlerData error ${res.status}: ${err.message ?? res.statusText}.${hint}`.replace('..', '.'));
  }
  return ((await res.json()) as any).result ?? {};
}

const baseShape = {
  query: z.string().describe('The search query.'),
  country: z.string().length(2).optional().describe('Two-letter country code for the results, for example us, gb or de.'),
  language: z.string().length(2).optional().describe('Two-letter language code, for example en or de.'),
};

const limit = <T>(items: T[] | undefined, options: CrawlerDataToolOptions): T[] =>
  (items ?? []).slice(0, Math.max(1, options.maxResults ?? DEFAULT_MAX_RESULTS));

const common = (options: CrawlerDataToolOptions, input: { query: string; country?: string; language?: string }): Params => ({
  query: input.query,
  country: input.country ?? options.country ?? 'us',
  language: input.language ?? options.language,
});

/** Google Search: organic results plus Google's AI Overview with the pages it cites, when Google shows one. */
export const crawlerdataSearch = (options: CrawlerDataToolOptions = {}) =>
  tool({
    description:
      "Search Google for current information. Returns the top organic results and, when Google shows one, Google's AI Overview with the pages it cites. Use it for facts, recent events and anything you are unsure about.",
    inputSchema: z.object({
      ...baseShape,
      device: z.enum(['desktop', 'mobile']).optional().describe('Desktop or mobile results. Default: desktop.'),
      location: z.string().optional().describe('City-level targeting, for example "Austin,Texas,United States".'),
    }),
    execute: async (input) => {
      const result = await run(options, 'google-search', { ...common(options, input), device: input.device, location: input.location });
      const overview = result.ai_overview?.text
        ? {
            text: result.ai_overview.text as string,
            sources: ((result.ai_overview.sources ?? []) as any[]).filter((s) => s?.link).map((s) => ({ title: s.title ?? '', link: s.link as string })),
          }
        : null;
      return {
        ai_overview: overview,
        organic_results: limit<any>(result.organic_results, options).map((r) => ({
          position: r.position, title: r.title ?? '', link: r.link ?? '', snippet: r.snippet ?? '',
        })),
        related_questions: ((result.people_also_ask ?? []) as any[]).map((q) => q?.question).filter(Boolean).slice(0, 5),
      };
    },
  });

/** Google News: recent articles on a topic. */
export const crawlerdataNews = (options: CrawlerDataToolOptions = {}) =>
  tool({
    description: 'Search Google News for recent articles about a topic. Returns title, source, date, snippet and link.',
    inputSchema: z.object(baseShape),
    execute: async (input) => {
      const result = await run(options, 'google-news', common(options, input));
      return {
        news_results: limit<any>(result.news_results, options).map((n) => ({
          title: n.title ?? '', source: n.source ?? '', date: n.date ?? '', link: n.link ?? '', snippet: n.snippet ?? '',
        })),
      };
    },
  });

/** Google Images. */
export const crawlerdataImages = (options: CrawlerDataToolOptions = {}) =>
  tool({
    description: 'Search Google Images. Returns the image URL, title, source page and size.',
    inputSchema: z.object(baseShape),
    execute: async (input) => {
      const result = await run(options, 'google-images', common(options, input));
      return {
        image_results: limit<any>(result.images_results, options).map((i) => ({
          title: i.title ?? '', image: i.original ?? i.thumbnail ?? '', source_page: i.link ?? '', source: i.source ?? '',
        })),
      };
    },
  });

/** Google Local: businesses for a place search. */
export const crawlerdataLocal = (options: CrawlerDataToolOptions = {}) =>
  tool({
    description: 'Find local businesses on Google, for example "coffee shops in Austin TX". Returns name, rating, reviews, category, address, phone and website.',
    inputSchema: z.object({ ...baseShape, location: z.string().optional().describe('City-level targeting, for example "Austin,Texas,United States".') }),
    execute: async (input) => {
      const result = await run(options, 'google-local', { ...common(options, input), location: input.location });
      return {
        local_results: limit<any>(result.local_results, options).map((b) => ({
          name: b.title ?? '', rating: b.rating, reviews: b.reviews, category: b.type ?? '', address: b.address ?? '',
          phone: b.phone ?? '', website: b.website ?? '',
        })),
      };
    },
  });

/** Google Autocomplete: suggestions for a partial query. */
export const crawlerdataAutocomplete = (options: CrawlerDataToolOptions = {}) =>
  tool({
    description: 'Get Google search suggestions for a partial query, for example "running sho".',
    inputSchema: z.object({ query: baseShape.query, country: baseShape.country }),
    execute: async (input) => {
      const result = await run(options, 'google-autocomplete', { query: input.query, country: input.country ?? options.country ?? 'us' });
      return { suggestions: limit<any>(result.suggestions, options).map((s) => s?.value ?? s).filter(Boolean) };
    },
  });

/** All CrawlerData tools, ready to spread into generateText({ tools }). */
export const crawlerdataTools = (options: CrawlerDataToolOptions = {}) => ({
  crawlerdataSearch: crawlerdataSearch(options),
  crawlerdataNews: crawlerdataNews(options),
  crawlerdataImages: crawlerdataImages(options),
  crawlerdataLocal: crawlerdataLocal(options),
  crawlerdataAutocomplete: crawlerdataAutocomplete(options),
});
