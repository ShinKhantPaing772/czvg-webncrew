export type UnknownRecord = Record<string, unknown>;

export type InfiniteFlightEnvelope<T> = {
  errorCode: number;
  result: T;
};

export type InfiniteFlightCacheStatus = "HIT" | "MISS";

export type InfiniteFlightResult<T> = {
  data: InfiniteFlightEnvelope<T>;
  cacheStatus: InfiniteFlightCacheStatus;
};

export type InfiniteFlightAircraft = {
  id: string;
  name: string;
};

export type InfiniteFlightLivery = {
  id: string;
  aircraftID?: string;
  aircraftId?: string;
  aircraftName: string;
  liveryName: string;
};

export type RequestOptions<T> = {
  path: string;
  cacheKey: string;
  ttlSeconds: number;
  method?: "GET" | "POST";
  body?: UnknownRecord;
  isValidResult: (value: unknown) => value is T;
};

export class InfiniteFlightApiError extends Error {
  readonly status: number;
  readonly apiErrorCode: number | null;

  constructor(message: string, status = 502, apiErrorCode: number | null = null) {
    super(message);
    this.name = "InfiniteFlightApiError";
    this.status = status;
    this.apiErrorCode = apiErrorCode;
  }
}
