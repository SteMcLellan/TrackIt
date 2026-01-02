/**
 * Standard collection response envelope.
 */
export type CollectionResponse<T> = {
  items: T[];
  nextToken: string | null;
};
