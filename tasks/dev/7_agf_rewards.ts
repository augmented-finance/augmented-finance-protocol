import { task } from 'hardhat/config';
import {
  deployAGFToken,
  deployLinearUnweightedRewardPool,
  deployRewardFreezer,
} from '../../helpers/contracts-deployments';

import { getRewardFreezer } from '../../helpers/contracts-getters';
import { waitForTx } from '../../helpers/misc-utils';

task('dev:agf-rewards', 'Deploy AGF token and reward pool.')
  .addFlag('verify', 'Verify contracts at Etherscan')
  .setAction(async ({ verify }, localBRE) => {
    await localBRE.run('set-DRE');

    const agfToken = await deployAGFToken(['Augmented finance governance token', 'AGF'], verify);
    const rewardFreezer = await deployRewardFreezer([agfToken.address], verify);

    const linearUnweightedRewardPool = await deployLinearUnweightedRewardPool(
      [rewardFreezer.address],
      verify
    );

    await waitForTx(
      await rewardFreezer.admin_addRewardPool(
        linearUnweightedRewardPool.address,
        linearUnweightedRewardPool.address // fixme: pass correct lookupKey
      )
    );
    await waitForTx(await linearUnweightedRewardPool.addRewardProvider(rewardFreezer.address)); // TODO address ?
  });
