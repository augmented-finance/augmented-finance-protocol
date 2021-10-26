import { BigNumber } from 'ethers';
import { task } from 'hardhat/config';
import { AccessFlags } from '../../helpers/access-flags';
import { ZERO_ADDRESS } from '../../helpers/constants';
import {
  deployDepositStakeTokenImpl,
  deployProtocolDataProvider,
  deployRewardConfiguratorImpl,
  deployStakeConfiguratorImpl,
  deployStakeTokenImpl,
} from '../../helpers/contracts-deployments';
import {
  getLendingPoolProxy,
  getMarketAccessController,
  getRewardBooster,
  getRewardConfiguratorProxy,
  getStakeConfiguratorImpl,
  getStakeTokenImpl,
} from '../../helpers/contracts-getters';
import { falsyOrZeroAddress, getFirstSigner, mustWaitTx, sleep, waitForTx } from '../../helpers/misc-utils';
import { MarketAccessController } from '../../types';

task('helper:deploy-samples', 'Deploy samples for verification').setAction(async (DRE) => {
  console.log('Deploy samples for verification');
});
