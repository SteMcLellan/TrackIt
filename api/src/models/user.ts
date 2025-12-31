/**
 * Cosmos DB user document shape.
 */
export interface UserDocument {
  id?: string;
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
  roles?: string[];
  settings?: Record<string, unknown>;
  createdAt: string;
  lastLoginAt: string;
}
