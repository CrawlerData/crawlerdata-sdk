import test from 'node:test';
import assert from 'node:assert/strict';
import { CrawlerData, CrawlerDataError } from '../index.js';

const OK = { job: { status: 'completed', credits: 1 }, result: { organic_results: [{ title: 'T' }] } };
const res = (status, body) => ({ ok: status < 400, status, json: async () => body });
function fakeFetch(...responses) {
  const calls = [];
  const f = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    const r = responses.shift();
    if (r instanceof Error) throw r;
    return r;
  };
  f.calls = calls;
  return f;
}
const noWait = { maxRetries: 2 };
// make retries instant
const realSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = (fn, ms, ...a) => realSetTimeout(fn, Math.min(ms, 1), ...a);

test('requires a key', () => {
  delete process.env.CRAWLERDATA_API_KEY;
  assert.throws(() => new CrawlerData(), /No API key/);
});

test('sends a live job with the bearer key and drops undefined params', async () => {
  const f = fakeFetch(res(200, OK));
  const out = await new CrawlerData({ apiKey: 'k', fetch: f }).search('best crm', { device: 'mobile', language: undefined });
  assert.deepEqual(out, OK.result);
  assert.equal(f.calls[0].url, 'https://api.crawlerdata.com/v1/jobs');
  assert.equal(f.calls[0].init.headers.Authorization, 'Bearer k');
  assert.deepEqual(f.calls[0].body, { endpoint: 'google-search', params: { query: 'best crm', country: 'us', device: 'mobile' }, queue: 'live' });
});

test('helpers use the right endpoint and param names', async () => {
  const cases = [
    [(c) => c.news('n'), 'google-news', { query: 'n', country: 'us' }],
    [(c) => c.local('l', { country: 'gb' }), 'google-local', { query: 'l', country: 'gb' }],
    [(c) => c.autocomplete('a'), 'google-autocomplete', { query: 'a', country: 'us' }],
    [(c) => c.shoppingSellers('123'), 'google-shopping-product', { product_id: '123', country: 'us' }],
    [(c) => c.shoppingProduct('123'), 'google-shopping-product-info', { product_id: '123', country: 'us' }],
  ];
  for (const [call, endpoint, params] of cases) {
    const f = fakeFetch(res(200, OK));
    await call(new CrawlerData({ apiKey: 'k', fetch: f }));
    assert.equal(f.calls[0].body.endpoint, endpoint);
    assert.deepEqual(f.calls[0].body.params, params);
  }
});

test('aiOverview returns text+sources or null', async () => {
  const withO = res(200, { result: { ai_overview: { text: 'A sitemap is', sources: [{ title: 'W', link: 'https://w' }] } } });
  const none = res(200, { result: { organic_results: [] } });
  assert.equal((await new CrawlerData({ apiKey: 'k', fetch: fakeFetch(withO) }).aiOverview('q')).sources[0].link, 'https://w');
  assert.equal(await new CrawlerData({ apiKey: 'k', fetch: fakeFetch(none) }).aiOverview('q'), null);
});

test('API errors carry status and code and are not retried', async () => {
  const f = fakeFetch(res(402, { error: { message: 'Insufficient credits', code: 'INSUFFICIENT_CREDITS' } }));
  await assert.rejects(new CrawlerData({ apiKey: 'k', fetch: f }).search('q'), (e) => e instanceof CrawlerDataError && e.status === 402 && e.code === 'INSUFFICIENT_CREDITS' && /Insufficient credits/.test(e.message));
  assert.equal(f.calls.length, 1);
});

test('retries 5xx and network errors, then succeeds', async () => {
  const f = fakeFetch(res(503, {}), new Error('boom'), res(200, OK));
  assert.deepEqual(await new CrawlerData({ apiKey: 'k', fetch: f, ...noWait }).search('q'), OK.result);
  assert.equal(f.calls.length, 3);
});

test('gives up after max retries', async () => {
  const f = fakeFetch(res(502, {}), res(502, {}), res(502, {}));
  await assert.rejects(new CrawlerData({ apiKey: 'k', fetch: f }).search('q'), (e) => e.status === 502);
  assert.equal(f.calls.length, 3);
});
