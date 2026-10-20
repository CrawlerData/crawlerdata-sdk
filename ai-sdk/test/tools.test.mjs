import test from 'node:test';
import assert from 'node:assert/strict';
import { generateText, isStepCount } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { crawlerdataSearch, crawlerdataNews, crawlerdataImages, crawlerdataLocal, crawlerdataAutocomplete, crawlerdataTools } from '../dist/index.js';

const SEARCH_RESULT = {
  ai_overview: {
    text: 'A sitemap lists the pages of a site.',
    sources: [{ title: 'Google Search Central', link: 'https://developers.google.com/sitemaps' }, { title: 'no link', link: '' }],
  },
  organic_results: Array.from({ length: 12 }, (_, i) => ({ position: i + 1, title: `Result ${i + 1}`, link: `https://example.com/${i + 1}`, displayed_link: 'example.com', snippet: `Snippet ${i + 1}` })),
  people_also_ask: [{ question: 'What is a sitemap?' }, { question: 'Do I need a sitemap?' }],
};

/** A fetch that records requests and answers with the given job result. */
function mockFetch(result, { status = 200, body } = {}) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    return new Response(JSON.stringify(body ?? { job: { status: 'completed', credits: 1 }, result }), { status, headers: { 'content-type': 'application/json' } });
  };
  fn.calls = calls;
  return fn;
}
const exec = (t, input) => t.execute(input, { toolCallId: 'call-1', messages: [] });

test('search sends a live google-search job with the Bearer key and returns a compact result', async () => {
  const f = mockFetch(SEARCH_RESULT);
  const t = crawlerdataSearch({ apiKey: 'test-key', fetch: f, maxResults: 5 });
  const out = await exec(t, { query: 'what is a sitemap', device: 'mobile' });
  assert.equal(f.calls[0].url, 'https://api.crawlerdata.com/v1/jobs');
  assert.equal(f.calls[0].init.headers.Authorization, 'Bearer test-key');
  assert.deepEqual(f.calls[0].body, { endpoint: 'google-search', params: { query: 'what is a sitemap', country: 'us', device: 'mobile' }, queue: 'live' });
  assert.equal(out.organic_results.length, 5);
  assert.deepEqual(out.organic_results[0], { position: 1, title: 'Result 1', link: 'https://example.com/1', snippet: 'Snippet 1' });
  assert.equal(out.ai_overview.text, 'A sitemap lists the pages of a site.');
  assert.deepEqual(out.ai_overview.sources, [{ title: 'Google Search Central', link: 'https://developers.google.com/sitemaps' }]);
  assert.deepEqual(out.related_questions, ['What is a sitemap?', 'Do I need a sitemap?']);
});

test('search returns ai_overview null when Google shows none, and honours default country/language', async () => {
  const f = mockFetch({ organic_results: [{ position: 1, title: 'A', link: 'https://a.test', snippet: 's' }] });
  const t = crawlerdataSearch({ apiKey: 'k', fetch: f, country: 'de', language: 'de' });
  const out = await exec(t, { query: 'hallo' });
  assert.equal(out.ai_overview, null);
  assert.deepEqual(f.calls[0].body.params, { query: 'hallo', country: 'de', language: 'de' });
});

test('the model can override country and location per call', async () => {
  const f = mockFetch(SEARCH_RESULT);
  await exec(crawlerdataSearch({ apiKey: 'k', fetch: f }), { query: 'coffee', country: 'gb', location: 'London,England,United Kingdom' });
  assert.deepEqual(f.calls[0].body.params, { query: 'coffee', country: 'gb', location: 'London,England,United Kingdom' });
});

test('news, images, local and autocomplete map their endpoints and results', async () => {
  let f = mockFetch({ news_results: [{ title: 'N', source: 'S', date: 'today', link: 'https://n.test', snippet: 'x', thumbnail: 'ignored' }] });
  assert.deepEqual(await exec(crawlerdataNews({ apiKey: 'k', fetch: f }), { query: 'nvidia' }), { news_results: [{ title: 'N', source: 'S', date: 'today', link: 'https://n.test', snippet: 'x' }] });
  assert.equal(f.calls[0].body.endpoint, 'google-news');

  f = mockFetch({ images_results: [{ position: 1, title: 'Dog', source: 'dogs.test', link: 'https://dogs.test/p', thumbnail: 't', original: 'https://dogs.test/dog.jpg' }] });
  assert.deepEqual(await exec(crawlerdataImages({ apiKey: 'k', fetch: f }), { query: 'dog' }), { image_results: [{ title: 'Dog', image: 'https://dogs.test/dog.jpg', source_page: 'https://dogs.test/p', source: 'dogs.test' }] });
  assert.equal(f.calls[0].body.endpoint, 'google-images');

  f = mockFetch({ local_results: [{ title: 'Cafe', rating: 4.6, reviews: 120, type: 'Coffee shop', address: '1 Main St', phone: '555', website: 'https://cafe.test', hours: 'x', sponsored: false }] });
  assert.deepEqual(await exec(crawlerdataLocal({ apiKey: 'k', fetch: f }), { query: 'coffee shops in austin' }), { local_results: [{ name: 'Cafe', rating: 4.6, reviews: 120, category: 'Coffee shop', address: '1 Main St', phone: '555', website: 'https://cafe.test' }] });
  assert.equal(f.calls[0].body.endpoint, 'google-local');

  f = mockFetch({ suggestions: [{ value: 'running shoes', type: 'q' }, { value: 'running shorts', type: 'q' }] });
  assert.deepEqual(await exec(crawlerdataAutocomplete({ apiKey: 'k', fetch: f }), { query: 'running sho' }), { suggestions: ['running shoes', 'running shorts'] });
  assert.equal(f.calls[0].body.endpoint, 'google-autocomplete');
});

test('a missing key fails clearly without calling the API', async () => {
  const saved = process.env.CRAWLERDATA_API_KEY;
  delete process.env.CRAWLERDATA_API_KEY;
  const f = mockFetch({});
  await assert.rejects(exec(crawlerdataSearch({ fetch: f }), { query: 'x' }), /API key missing/);
  assert.equal(f.calls.length, 0);
  if (saved) process.env.CRAWLERDATA_API_KEY = saved;
});

test('the key is read from CRAWLERDATA_API_KEY', async () => {
  process.env.CRAWLERDATA_API_KEY = 'env-key';
  const f = mockFetch(SEARCH_RESULT);
  await exec(crawlerdataSearch({ fetch: f }), { query: 'x' });
  assert.equal(f.calls[0].init.headers.Authorization, 'Bearer env-key');
  delete process.env.CRAWLERDATA_API_KEY;
});

test('API errors become readable messages (401, 402)', async () => {
  const bad = mockFetch(null, { status: 401, body: { error: { code: 'UNAUTHORIZED', message: 'Invalid API key' } } });
  await assert.rejects(exec(crawlerdataSearch({ apiKey: 'k', fetch: bad }), { query: 'x' }), /CrawlerData error 401: Invalid API key\. Check the API key\./);
  const broke = mockFetch(null, { status: 402, body: { error: { code: 'INSUFFICIENT_CREDITS', message: 'Not enough credits' } } });
  await assert.rejects(exec(crawlerdataSearch({ apiKey: 'k', fetch: broke }), { query: 'x' }), /out of credits/);
});

test('network failures are reported, not thrown raw', async () => {
  const f = async () => { throw new Error('socket hang up'); };
  await assert.rejects(exec(crawlerdataSearch({ apiKey: 'k', fetch: f }), { query: 'x' }), /Could not reach CrawlerData: socket hang up/);
});

test('input schemas validate: query required, country must be two letters', () => {
  const t = crawlerdataSearch({ apiKey: 'k' });
  const schema = t.inputSchema;
  const parsed = (v) => (schema['~standard'] ? schema['~standard'].validate(v) : schema.safeParse(v));
  assert.ok(!('issues' in (parsed({ query: 'ok' }))) || !parsed({ query: 'ok' }).issues);
  const noQuery = parsed({});
  assert.ok(noQuery.issues?.length || noQuery.success === false);
  const badCountry = parsed({ query: 'x', country: 'usa' });
  assert.ok(badCountry.issues?.length || badCountry.success === false);
});

test('crawlerdataTools exposes all five tools', () => {
  assert.deepEqual(Object.keys(crawlerdataTools({ apiKey: 'k' })), ['crawlerdataSearch', 'crawlerdataNews', 'crawlerdataImages', 'crawlerdataLocal', 'crawlerdataAutocomplete']);
});

test('end to end with generateText: the model calls the tool and answers from its result', async () => {
  const f = mockFetch(SEARCH_RESULT);
  let step = 0;
  const model = new MockLanguageModelV4({
    doGenerate: async () => {
      step++;
      if (step === 1) {
        return {
          content: [{ type: 'tool-call', toolCallId: 'c1', toolName: 'crawlerdataSearch', input: JSON.stringify({ query: 'what is a sitemap' }) }],
          finishReason: { unified: 'tool-calls', raw: 'tool_calls' },
          usage: { inputTokens: { total: 5 }, outputTokens: { total: 5 } },
          warnings: [],
        };
      }
      return {
        content: [{ type: 'text', text: 'Google says a sitemap lists the pages of a site.' }],
        finishReason: { unified: 'stop', raw: 'stop' },
        usage: { inputTokens: { total: 5 }, outputTokens: { total: 5 } },
        warnings: [],
      };
    },
  });
  const { text, steps } = await generateText({
    model,
    prompt: 'What is a sitemap? Use Google.',
    tools: { crawlerdataSearch: crawlerdataSearch({ apiKey: 'k', fetch: f }) },
    stopWhen: isStepCount(3),
  });
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].body.params.query, 'what is a sitemap');
  assert.match(text, /sitemap/);
  const toolResult = steps[0].toolResults[0];
  assert.equal(toolResult.toolName, 'crawlerdataSearch');
  assert.equal(toolResult.output.ai_overview.text, 'A sitemap lists the pages of a site.');
});
