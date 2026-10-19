export interface CrawlerDataOptions {
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
  maxRetries?: number;
  fetch?: typeof fetch;
}
export interface RequestOptions {
  country?: string;
  [param: string]: unknown;
}
export interface SearchOptions extends RequestOptions {
  device?: 'desktop' | 'mobile';
}
export interface AiOverview {
  text: string;
  sources: { title: string; link: string }[];
}
export type Result = Record<string, any>;
export interface JobResponse {
  job: { status: string; credits?: number; [k: string]: unknown };
  result: Result;
}

export class CrawlerDataError extends Error {
  status?: number;
  code?: string;
  details?: unknown;
}

export class CrawlerData {
  constructor(options?: CrawlerDataOptions);
  run(endpoint: string, params?: Record<string, unknown>, options?: { queue?: string }): Promise<JobResponse>;
  search(query: string, options?: SearchOptions): Promise<Result>;
  aiOverview(query: string, options?: SearchOptions): Promise<AiOverview | null>;
  news(query: string, options?: RequestOptions): Promise<Result>;
  images(query: string, options?: RequestOptions): Promise<Result>;
  local(query: string, options?: RequestOptions): Promise<Result>;
  autocomplete(query: string, options?: RequestOptions): Promise<Result>;
  shoppingSearch(query: string, options?: RequestOptions): Promise<Result>;
  shoppingSellers(productId: string, options?: RequestOptions): Promise<Result>;
  shoppingProduct(productId: string, options?: RequestOptions): Promise<Result>;
}
export default CrawlerData;
