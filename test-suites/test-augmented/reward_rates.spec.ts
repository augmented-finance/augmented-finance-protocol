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
import { currentTick, mineBlocks, mineTicks, revertSnapshot, takeSnapshot } from './utils';
import {
  MAX_LOCKER_PERIOD,
  MAX_UINT_AMOUNT,
  ONE_ADDRESS,
  PERC_100,
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
import { BigNumber, Contract } from 'ethers';

chai.use(solidity);
const { expect } = chai;

describe('Reward rates suite', () => {
  let root: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let rewardController: RewardFreezer;
  let pools: IManagedRewardPool[];
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

    pools = [];
    const pushPool = (c: Contract) => {
      pools.push(IManagedRewardPoolFactory.connect(c.address, root));
    };

    const ac = await getMarketAccessController();
    await ac.grantRoles(root.address, AccessFlags.REWARD_RATE_ADMIN);

    refPool = await deployReferralRewardPool('RefPool', [
      rewardController.address,
      defaultRate,
      PERC_100,
    ]);
    await rewardController.addRewardPool(refPool.address);

    {
      const pool = await deployTreasuryRewardPool([
        rewardController.address,
        defaultRate,
        PERC_100,
        root.address,
      ]);
      await rewardController.addRewardPool(pool.address);
      pushPool(pool);
    }
    {
      const pool = await getTokenWeightedRewardPoolAGFSeparate();
      await pool.setRate(defaultRate);
      await pool.setBaselinePercentage(PERC_100);
      await pool.handleBalanceUpdate(ONE_ADDRESS, root.address, 0, 1, 1); // 100%
      pushPool(pool);
    }

    {
      const pool = await getTeamRewardPool();
      await pool.setRate(defaultRate);
      await pool.setBaselinePercentage(PERC_100);
      await pool.setUnlockedAt(1);
      await pool.updateTeamMember(root.address, 10000); // 100%
      pushPool(pool);
    }

    {
      agf.mintReward(root.address, 1, false);

      const pool = await getMockTokenLocker();
      await pool.setRate(defaultRate);
      await pool.setBaselinePercentage(PERC_100);
      await agf.approve(pool.address, MAX_UINT_AMOUNT);
      await pool.lock(1, MAX_LOCKER_PERIOD + WEEK, 0);
      pushPool(pool);
    }
  });

  afterEach(async () => {
    await revertSnapshot(blkBeforeDeploy);
  });

  it('different pool types should have same outcome for the same rate', async () => {
    await mineBlocks(1);
    const startedAt = await currentTick();
    const preValues: string[] = [];

    for (const pool of pools) {
      preValues.push((await pool.calcRewardFor(root.address)).amount.toString());
    }
    preValues.push((await refPool.availableReward()).toString());

    await mineTicks(10);
    const tickCount = (await currentTick()) - startedAt;

    const postValues: string[] = [];

    for (const pool of pools) {
      postValues.push(
        (await pool.calcRewardFor(root.address)).amount.sub(tickCount * defaultRate).toString()
      );
    }
    postValues.push((await refPool.availableReward()).sub(tickCount * defaultRate).toString());

    expect(postValues).eql(preValues);
  });

  it('coordinated rate change accross different pool types', async () => {
    await rewardController.claimReward();
    const startedAt = await currentTick();
    const preReward = await agf.balanceOf(root.address);
    const preRewardRef = await refPool.availableReward();

    await mineTicks(10);

    const defaultRate2 = 3;
    // as all pools have baseline = 100% this call will set rate of each pool = defaultRate2
    await rewardController.updateBaseline(defaultRate2);
    const tickCount = (await currentTick()) - startedAt;

    expect(await refPool.getRate()).eq(defaultRate2);
    for (const pool of pools) {
      expect(await pool.getRate()).eq(defaultRate2);
    }

    await mineTicks(11);

    const tickCount2 = (await currentTick()) - startedAt - tickCount;
    const perPoolReward2 = tickCount * defaultRate + tickCount2 * defaultRate2;

    for (const pool of pools) {
      expect((await pool.calcRewardFor(root.address)).amount).eq(perPoolReward2); // one tick less, as this has to be before claimReward
    }

    await rewardController.claimReward();

    const tickCount3 = (await currentTick()) - startedAt - tickCount;
    const perPoolReward3 = tickCount * defaultRate + tickCount3 * defaultRate2;

    expect(await refPool.availableReward()).eq(preRewardRef.add(perPoolReward3).toNumber());
    expect(await agf.balanceOf(root.address)).eq(
      preReward.add(perPoolReward3 * pools.length).toNumber()
    );
  });
});