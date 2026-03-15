import { Container } from '@azure/cosmos';
import { HeroPhraseTiersDocument } from '../../models/hero-phrase-tiers';

export async function readHeroPhraseTiers(
  container: Container
): Promise<HeroPhraseTiersDocument | null> {
  const { resource } = await container.item('default', 'default').read<HeroPhraseTiersDocument>();
  return resource ?? null;
}
