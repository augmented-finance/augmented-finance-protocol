import { task } from 'hardhat/config';
import {
  deployAGFToken,
  deployFixedRewardPool,
  deployLinearWeightedRewardPool,
  deployRewardFreezer,
} from '../../helpers/contracts-deployments';

import { getLendingPoolAddressesProvider } from '../../helpers/contracts-getters';

task('dev:agf-rewards', 'Deploy AGF token and reward pool.')
  .addFlag('verify', 'Verify contracts at Etherscan')
  .setAction(async ({ verify }, localBRE) => {
    await localBRE.run('set-DRE');

    // todo :
    const agfToken = await deployAGFToken(['Augmented finance governance token', 'AGF'], verify);
    const rewardFreezer = await deployRewardFreezer([agfToken.address], verify);

    await deployFixedRewardPool([rewardFreezer.address], verify);
    await deployLinearWeightedRewardPool([rewardFreezer.address, 10], verify);
  });
