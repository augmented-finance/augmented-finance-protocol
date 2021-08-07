import { task } from 'hardhat/config';
import { ONE_ADDRESS, ZERO_ADDRESS } from '../../helpers/constants';
import {
  deployAGFTokenV1Impl,
  deployDelegationAwareDepositTokenImpl,
  deployDepositTokenImpl,
  deployLendingPoolExtensionImpl,
  deployLendingPoolImpl,
  deployMockDecayingTokenLocker,
  deployMockTokenLocker,
  deployReferralRewardPoolV1Impl,
  deployRewardBoosterV1Impl,
  deployRewardConfiguratorImpl,
  deployStableDebtTokenImpl,
  deployStakeConfiguratorImpl,
  deployStakeTokenImpl,
  deployTokenWeightedRewardPoolAG,
  deployTokenWeightedRewardPoolImpl,
  deployVariableDebtTokenImpl,
  deployXAGFTokenV1Impl,
} from '../../helpers/contracts-deployments';

task('dev:deploy-samples', 'Deploy samples for verification').setAction(async (DRE) => {
  console.log('Deploy samples for verification');

  await deployTokenWeightedRewardPoolImpl(true, false);
  await deployReferralRewardPoolV1Impl(true, false);
  // await deployAGFTokenV1Impl(true, false); // OK

  // await deployLendingPoolImpl(true, false); // OK
  // await deployLendingPoolExtensionImpl(true, false); // OK

  // await deployDepositTokenImpl(true, false); // OK
  // await deployDelegationAwareDepositTokenImpl(true, false); // OK

  // await deployVariableDebtTokenImpl(true, false); // OK
  // await deployStableDebtTokenImpl(true, false); // OK

  // await deployXAGFTokenV1Impl(true, false); // max 500k
  // await deployRewardConfiguratorImpl(true, false);
  // await deployStakeConfiguratorImpl(true, false);
  // await deployRewardBoosterV1Impl(true, false);
  // await deployStakeTokenImpl(true, false);      // max 500k
});
