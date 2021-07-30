import chai from 'chai';

import { solidity } from 'ethereum-waffle';
import rawBRE from 'hardhat';

import {
  getMarketAccessController,
  getMockAgfToken,
  getMockRewardFreezer,
  getMockTokenLocker,
  getTeamRewardPool,
  getTokenWeightedRewardPoolAGFSeparate,
} from '../../helpers/contracts-getters';

import { MockAgfToken, ReferralRewardPool, RewardFreezer } from '../../types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { mineTicks, revertSnapshot, takeSnapshot } from './utils';
import {
  MAX_LOCKER_PERIOD,
  MAX_UINT_AMOUNT,
  ONE_ADDRESS,
  RAY,
  WEEK,
} from '../../helpers/constants';
import { CFG } from '../../tasks/migrations/defaultTestDeployConfig';
import {
  deployReferralRewardPool,
  deployTreasuryRewardPool,
} from '../../helpers/contracts-deployments';
import { AccessFlags } from '../../helpers/access-flags';
import { IManagedRewardPool } from '../../types/IManagedRewardPool';
import { IManagedRewardPoolFactory } from '../../types/IManagedRewardPoolFactory';
import { Contract } from 'ethers';

chai.use(solidity);
const { expect } = chai;

describe('Reward rates suite', () => {
  let root: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let rewardController: RewardFreezer;
  let pools: IManagedRewardPool[] = [];
  let agf: MockAgfToken;
  let blkBeforeDeploy;
  let refPool: ReferralRewardPool;
  const defaultRate = 1;

  beforeEach(async () => {
    blkBeforeDeploy = await takeSnapshot();
    [root, user1, user2] = await (<any>rawBRE).ethers.getSigners();
    await rawBRE.run('augmented:test-local', CFG);
    agf = await getMockAgfToken();
    rewardController = await getMockRewardFreezer();
    await rewardController.setFreezePercentage(0);

    const pushPool = (c: Contract) => {
      pools.push(IManagedRewardPoolFactory.connect(c.address, root));
    };

    const ac = await getMarketAccessController();
    await ac.grantRoles(root.address, AccessFlags.REWARD_RATE_ADMIN);

    refPool = await deployReferralRewardPool('RefPool', [
      rewardController.address,
      defaultRate,
      RAY,
      0,
    ]);

    {
      const pool = await deployTreasuryRewardPool([
        rewardController.address,
        defaultRate,
        RAY,
        0,
        root.address,
      ]);
      await rewardController.addRewardPool(pool.address);
      pushPool(pool);
    }
    {
      const pool = await getTokenWeightedRewardPoolAGFSeparate();
      await pool.setRate(defaultRate);
      await pool.handleBalanceUpdate(ONE_ADDRESS, root.address, 0, 1, 1); // 100%
      pushPool(pool);
    }

    {
      const pool = await getTeamRewardPool();
      await pool.setRate(defaultRate);
      await pool.setUnlockedAt(1);
      await pool.updateTeamMember(root.address, 10000); // 100%
      pushPool(pool);
    }

    {
      agf.mintReward(root.address, 1, false);

      const pool = await getMockTokenLocker();
      await pool.setRate(defaultRate);
      await agf.approve(pool.address, MAX_UINT_AMOUNT);
      await pool.lock(1, MAX_LOCKER_PERIOD + WEEK, 0);
      pushPool(pool);
    }
  });

  afterEach(async () => {
    await revertSnapshot(blkBeforeDeploy);
  });

  it('different pool types should have same outcome for the same rate', async () => {
    const tickCount = 10;

    const preValues: string[] = [];
    preValues.push((await refPool.availableReward()).add(tickCount * defaultRate).toString());

    for (const pool of pools) {
      preValues.push(
        (await pool.calcRewardFor(root.address)).amount.add(tickCount * defaultRate).toString()
      );
    }
    await mineTicks(tickCount);

    const postValues: string[] = [];
    postValues.push((await refPool.availableReward()).toString());

    for (const pool of pools) {
      postValues.push((await pool.calcRewardFor(root.address)).amount.toString());
    }

    expect(postValues).eql(preValues);
  });
});
