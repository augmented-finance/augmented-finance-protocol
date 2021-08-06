import { task } from 'hardhat/config';
import { ONE_ADDRESS, ZERO_ADDRESS } from '../../helpers/constants';
import {
  deployDelegationAwareDepositTokenImpl,
  deployDepositTokenImpl,
  deployMockDecayingTokenLocker,
  deployMockTokenLocker,
  deployRewardBoosterV1Impl,
  deployRewardConfiguratorImpl,
  deployStableDebtTokenImpl,
  deployStakeConfiguratorImpl,
  deployStakeTokenImpl,
  deployVariableDebtTokenImpl,
  deployXAGFTokenV1Impl,
} from '../../helpers/contracts-deployments';

task('dev:deploy-samples', 'Deploy samples for verification').setAction(async (DRE) => {
  console.log('Deploy samples for verification');

  // await deployDepositTokenImpl(true, false); // OK
  // await deployVariableDebtTokenImpl(true, false); // OK

  // await deployXAGFTokenV1Impl(true, false); // max 500k
  await deployMockTokenLocker(
    [
      '0x64b8e49baded7bfb2fd5a9235b2440c0ee02971b',
      0,
      1,
      '0x64b8e49baded7bfb2fd5a9235b2440c0ee02971b',
    ],
    true
  );
  // await deployRewardConfiguratorImpl(true, false);
  // await deployStakeConfiguratorImpl(true, false);
  // await deployRewardBoosterV1Impl(true, false);

  // await deployDelegationAwareDepositTokenImpl(true, false); // max 500k
  // await deployStakeTokenImpl(true, false);      // max 500k
  // await deployStableDebtTokenImpl(true, false); // max 500k
});
