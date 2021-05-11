import { task, types } from 'hardhat/config';
import {
  deployAaveAdapter,
  deployAugmentedMigrator,
  deployCompAdapter,
  deployMockAgfToken,
  deployRewardFreezer,
  deployZombieRewardPool,
} from '../../helpers/contracts-deployments';
import { ONE_ADDRESS, RAY, ZERO_ADDRESS } from '../../helpers/constants';
import { waitForTx } from '../../helpers/misc-utils';

// mainnet addresses
export const ADAI_ADDRESS = '0x028171bca77440897b824ca71d1c56cac55b68a3';
export const CDAI_ADDRESS = '0x5d3a536e4d6dbd6114cc1ead35777bab948e3643';
export const DAI_ADDRESS = '0x6b175474e89094c44da98b954eedeac495271d0f';
export const LP_ADDRESS = '0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9';

task('dev:augmented-migrator', 'Deploy Augmented Migrator contracts.')
  .addOptionalParam('aDaiAddress', 'AAVE DAI address', ADAI_ADDRESS, types.string)
  .addOptionalParam('cDaiAddress', 'Compound DAI address', CDAI_ADDRESS, types.string)
  .addOptionalParam('daiAddress', 'DAI address', DAI_ADDRESS, types.string)
  .addFlag('verify', 'Verify contracts at Etherscan')
  .setAction(async ({ aDaiAddress, cDaiAddress, daiAddress, verify }, localBRE) => {
    await localBRE.run('set-DRE');
    const [root] = await localBRE.ethers.getSigners();

    const migrator = await deployAugmentedMigrator(verify);

    const aDAIAdapter = await deployAaveAdapter([migrator.address, aDaiAddress], verify);
    await migrator.admin_registerAdapter(aDAIAdapter.address);
    // const cDAIAdapter = await deployCompAdapter(
    //   [migrator.address, cDaiAddress, daiAddress],
    //   verify
    // );
    // await migrator.admin_registerAdapter(cDAIAdapter.address);

    const agfToken = await deployMockAgfToken(
      [ZERO_ADDRESS, 'Reward token updated', 'AGF'],
      verify
    );

    const rewardFreezer = await deployRewardFreezer([ZERO_ADDRESS, agfToken.address], verify);
    await waitForTx(await rewardFreezer.admin_setFreezePercentage(0));

    // deploy zombie pool, register in controller, add deployer(root) as provider
    const zombieRewardPool = await deployZombieRewardPool(
      [
        rewardFreezer.address,
        [aDaiAddress, cDaiAddress],
        [
          { rateRay: RAY, limit: 5000 },
          { rateRay: RAY, limit: 5000 },
        ],
      ],
      verify
    );
    await waitForTx(await rewardFreezer.admin_addRewardPool(zombieRewardPool.address));
    await waitForTx(
      await rewardFreezer.admin_addRewardProvider(
        zombieRewardPool.address,
        aDAIAdapter.address,
        aDaiAddress
      )
    );
    await aDAIAdapter.admin_setRewardPool(zombieRewardPool.address);
    // await migrator.admin_setRewardPool(aDAIAdapter.address, zombieRewardPool.address);
  });
