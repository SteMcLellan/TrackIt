export interface UserDocument {
  id?: string;
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
  roles?: string[];
  settings?: Record<string, any>;
  createdAt: string;
  lastLoginAt: string;
}
