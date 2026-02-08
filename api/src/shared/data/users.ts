import { Container } from '@azure/cosmos';
import { UserDocument } from '../../models/user';

export async function readUserBySub(
  container: Container,
  sub: string
): Promise<UserDocument | null> {
  const { resource } = await container.item(sub, sub).read<UserDocument>();
  return resource ?? null;
}
