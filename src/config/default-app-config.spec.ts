import { DefaultAppConfig } from './default-app-config';

describe('DefaultAppConfig', () => {
  describe('bundle.standardBundles', () => {
    let standardBundles: string[];

    beforeEach(() => {
      standardBundles = new DefaultAppConfig().bundle.standardBundles;
    });

    it('should keep offering the out-of-the-box DSpace bundles', () => {
      expect(standardBundles).toContain('ORIGINAL');
      expect(standardBundles).toContain('THUMBNAIL');
      expect(standardBundles).toContain('LICENSE');
    });

    it('should offer CC-LICENSE, so a Creative Commons licence can be added to an item', () => {
      expect(standardBundles).toContain('CC-LICENSE');
    });
  });
});
