// CrawlerData: Google Search (SERP), AI Overview, News, Images, Local, Autocomplete and Google Shopping as JSON.
// Zero dependencies; needs Node 18+ (global fetch). https://crawlerdata.com
const DEFAULT_BASE_URL = 'https://api.crawlerdata.com';
const RETRY_STATUS = new Set([429, 500, 502, 503, 504]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class CrawlerDataError extends Error {
  constructor(message, { status, code, details } = {}) {
    super(status ? `${message} (HTTP ${status}${code ? ', ' + code : ''})` : message);
    this.name = 'CrawlerDataError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class CrawlerData {
  /**
   * @param {{ apiKey?: string, baseUrl?: string, timeoutMs?: number, maxRetries?: number, fetch?: typeof fetch }} [options]
   * Create an API key at https://app.crawlerdata.com (50 free credits for new accounts with a verified work email).
   */
  constructor(options = {}) {
    this.apiKey = options.apiKey ?? process.env.CRAWLERDATA_API_KEY;
    if (!this.apiKey) throw new CrawlerDataError('No API key: pass { apiKey } or set CRAWLERDATA_API_KEY (create one at https://app.crawlerdata.com).');
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.timeoutMs = options.timeoutMs ?? 200_000;
    this.maxRetries = options.maxRetries ?? 2;
    this._fetch = options.fetch ?? globalThis.fetch;
  }

  /** One request; resolves to the full response { job: {status, credits, ...}, result }. */
  async run(endpoint, params = {}, { queue = 'live' } = {}) {
    const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null));
    const body = JSON.stringify({ endpoint, params: clean, queue });
    let last;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const res = await this._fetch(`${this.baseUrl}/v1/jobs`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
          body,
          signal: AbortSignal.timeout(this.timeoutMs),
        });
        if (res.ok) return await res.json();
        const err = ((await res.json().catch(() => ({}))) ?? {}).error ?? {};
        last = new CrawlerDataError(err.message ?? `HTTP ${res.status}`, { status: res.status, code: err.code, details: err.details });
        if (!RETRY_STATUS.has(res.status)) throw last;
      } catch (e) {
        if (e instanceof CrawlerDataError && !RETRY_STATUS.has(e.status)) throw e;
        last = e instanceof CrawlerDataError ? e : new CrawlerDataError(`Could not reach CrawlerData: ${e.message}`);
      }
      if (attempt < this.maxRetries) await sleep(1500 * (attempt + 1));
    }
    throw last;
  }

  async #result(endpoint, params) {
    return (await this.run(endpoint, params)).result ?? {};
  }

  /** Google Search: organic_results, ads, ai_overview, people_also_ask, local_pack, top_stories, related_searches... */
  search(query, { country = 'us', device, ...rest } = {}) {
    return this.#result('google-search', { query, country, device, ...rest });
  }
  /** The AI Overview { text, sources: [{ title, link }] }, or null when Google shows none. */
  async aiOverview(query, options = {}) {
    const o = (await this.search(query, options)).ai_overview;
    return o && typeof o === 'object' && o.text ? o : null;
  }
  news(query, { country = 'us', ...rest } = {}) { return this.#result('google-news', { query, country, ...rest }); }
  images(query, { country = 'us', ...rest } = {}) { return this.#result('google-images', { query, country, ...rest }); }
  local(query, { country = 'us', ...rest } = {}) { return this.#result('google-local', { query, country, ...rest }); }
  autocomplete(query, { country = 'us', ...rest } = {}) { return this.#result('google-autocomplete', { query, country, ...rest }); }
  shoppingSearch(query, { country = 'us', ...rest } = {}) { return this.#result('google-shopping-search', { query, country, ...rest }); }
  /** Every seller for a product, sorted by total price (1 credit per 10 sellers). */
  shoppingSellers(productId, { country = 'us', ...rest } = {}) { return this.#result('google-shopping-product', { product_id: productId, country, ...rest }); }
  shoppingProduct(productId, { country = 'us', ...rest } = {}) { return this.#result('google-shopping-product-info', { product_id: productId, country, ...rest }); }
}

export default CrawlerData;
