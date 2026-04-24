/**
 * Cosmos DB user document shape.
 */
export interface UserDocument {
  id?: string;
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
  settings?: Record<string, unknown>;
  createdAtUtc: string;
  lastLoginAtUtc: string;
}
