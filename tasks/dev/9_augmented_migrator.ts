import { task, types } from 'hardhat/config';
import {
  deployAaveAdapter,
  deployAugmentedMigrator,
  deployMigratorWeightedRewardPool,
  deployMockAgfToken,
  deployRewardFreezer,
  deployZombieAdapter,
  deployZombieRewardPool,
} from '../../helpers/contracts-deployments';
import { oneRay, RAY, ZERO_ADDRESS } from '../../helpers/constants';

// mainnet addresses
export const ADAI_ADDRESS = '0x028171bca77440897b824ca71d1c56cac55b68a3';
export const CDAI_ADDRESS = '0x5d3a536e4d6dbd6114cc1ead35777bab948e3643';
// export const DAI_ADDRESS = '0x6b175474e89094c44da98b954eedeac495271d0f';
export const LP_ADDRESS = '0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9';

task('dev:augmented-migrator', 'Deploy Augmented Migrator contracts.')
  .addOptionalParam('aDaiAddress', 'AAVE DAI address', ADAI_ADDRESS, types.string)
  .addOptionalParam('cDaiAddress', 'Compound DAI address', CDAI_ADDRESS, types.string)
  .addFlag('withZombieAdapter', 'deploy with zombie adapter of aDai')
  .addFlag('withAAVEAdapter', 'deploy with AAVE adapter of aDai')
  .addFlag('verify', 'Verify contracts at Etherscan')
  .setAction(
    async ({ aDaiAddress, cDaiAddress, withZombieAdapter, withAAVEAdapter, verify }, localBRE) => {
      await localBRE.run('set-DRE');

      const agfToken = await deployMockAgfToken(
        [ZERO_ADDRESS, 'Reward token updated', 'AGF'],
        verify
      );

      const rewardFreezer = await deployRewardFreezer([ZERO_ADDRESS, agfToken.address], verify);
      await rewardFreezer.admin_setFreezePercentage(0);

      const migrator = await deployAugmentedMigrator(verify);

      let adapter;
      let tokenAddr: string;
      let rp;
      if (withZombieAdapter) {
        adapter = await deployZombieAdapter([migrator.address, aDaiAddress]);
        tokenAddr = aDaiAddress;
        rp = await deployZombieRewardPool(
          [rewardFreezer.address, [tokenAddr], [{ rateRay: RAY, limit: RAY }]],
          verify
        );
      } else if (withAAVEAdapter) {
        adapter = await deployAaveAdapter([migrator.address, aDaiAddress], verify);
        tokenAddr = await adapter.UNDERLYING_ASSET_ADDRESS();
        rp = await deployMigratorWeightedRewardPool(
          [rewardFreezer.address, RAY, 0, oneRay.multipliedBy(100).toFixed(), tokenAddr],
          verify
        );
      } else {
        throw Error('provide deployment flag: withZombieAdapter: true or withAAVEAdapter: true');
      }
      await migrator.admin_registerAdapter(adapter.address);
      await rewardFreezer.admin_addRewardPool(rp.address);
      await rp.addRewardProvider(adapter.address, tokenAddr);
      await migrator.admin_setRewardPool(adapter.address, rp.address);
    }
  );
