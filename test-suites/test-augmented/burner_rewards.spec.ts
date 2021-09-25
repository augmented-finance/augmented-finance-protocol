import chai from 'chai';

import { solidity } from 'ethereum-waffle';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { BUIDLEREVM_CHAINID } from '../../helpers/buidler-constants';
import rawBRE from 'hardhat';

import { getPermitFreezerRewardPool, getMockRewardFreezer } from '../../helpers/contracts-getters';

import { PermitFreezerRewardPool, RewardFreezer } from '../../types';
import { CFG } from '../../tasks/migrations/defaultTestDeployConfig';

import { revertSnapshot, takeSnapshot } from './utils';
import { currentTick, mineTicks, revertSnapshot, takeSnapshot } from './utils';
import { _TypedDataEncoder } from '@ethersproject/hash';
import { buildRewardClaimPermitParams, encodeTypeHash } from '../../helpers/contracts-helpers';
import { keccak256 } from '@ethersproject/keccak256';
import { toUtf8Bytes } from '@ethersproject/strings';
import { hexlify, splitSignature } from '@ethersproject/bytes';
import { WAD, ZERO_ADDRESS } from '../../helpers/constants';
import { BigNumber, BigNumberish } from '@ethersproject/bignumber';
import { tEthereumAddress } from '../../helpers/types';

chai.use(solidity);
const { expect } = chai;

// makeSuite('Rewards test suite', (testEnv: TestEnv) => {
describe('Rewards by permit test suite', () => {
  let deployer: SignerWithAddress;
  let user: SignerWithAddress;
  let user2: SignerWithAddress;

  let rewardCtl: RewardFreezer;
  let pool: PermitFreezerRewardPool;

  let domainParams = {
    name: '',
    revision: '',
    chainId: 0,
    contract: '',
  };

  let blkBeforeDeploy;

  before(async () => {
    await rawBRE.run('set-DRE');
    await rawBRE.run('augmented:test-local', CFG);

    [deployer, user, user2] = await getSigners();

    // TODO each test below needs a separate freezer
    rewardCtl = await getMockRewardFreezer();
    expect(rewardCtl.address).to.properAddress;
    await rewardCtl.setFreezePercentage(0);

    pool = await getPermitFreezerRewardPool();
    await pool.addRewardProvider(deployer.address, ZERO_ADDRESS);
    await pool.setFreezePercentage(10000); // 100%

    domainParams = {
      name: await pool.getPoolName(),
      revision: '1',
      chainId: rawBRE.network.config.chainId || BUIDLEREVM_CHAINID,
      contract: pool.address,
    };
  });

  beforeEach(async () => {
    blkBeforeDeploy = await takeSnapshot();
  });

  afterEach(async () => {
    await revertSnapshot(blkBeforeDeploy);
  });

  it('Checks the domain separator and claim format', async () => {
    expect(await pool.EIP712_REVISION()).to.be.equal(hexlify(toUtf8Bytes(domainParams.revision)));

    const params = buildRewardClaimPermitParams(domainParams);

    expect(await pool.DOMAIN_SEPARATOR()).eq(_TypedDataEncoder.hashDomain(params.domain));
    expect(await pool.CLAIM_TYPEHASH()).eq(encodeTypeHash(params.primaryType, params.types));
  });

  const claimReward = async (user: tEthereumAddress, amount: BigNumberish, expiry?: number, nonce?: BigNumber) => {
    const params = buildRewardClaimPermitParams(domainParams, {
      provider: deployer.address,
      spender: user,
      value: amount,
      nonce: nonce || (await pool.nonces(user)),
      deadline: (await currentTick()) + (expiry || 10),
    });

    const signature = await deployer._signTypedData(params.domain, params.types, params.message!);
    const { v, r, s } = splitSignature(signature);

    const m = params.message;
    return await pool.claimRewardByPermit(m.provider, m.spender, m.value, m.deadline, v, r, s);
  };

  it('Should claim reward without freeze', async () => {
    // expect(await agf.balanceOf(user.address)).to.eq(0);
    await pool.setFreezePercentage(0);

    {
      const rewards = await rewardCtl.claimableReward(user.address);
      expect(rewards.claimable.add(rewards.extra)).to.eq(0);
    }

    await claimReward(user.address, WAD);

    {
      const rewards = await rewardCtl.claimableReward(user.address);
      expect(rewards.claimable).to.eq(WAD);
      expect(rewards.extra).to.eq(0);
    }
  });

  it('Should claim reward with freeze', async () => {
    {
      const rewards = await rewardCtl.claimableReward(user.address);
      expect(rewards.claimable.add(rewards.extra)).to.eq(0);
    }

    await claimReward(user.address, WAD);

    {
      const rewards = await rewardCtl.claimableReward(user.address);
      expect(rewards.claimable).to.eq(0);
      expect(rewards.extra).to.eq(WAD);
    }
  });

  it('Should not claim twice for the same nonce', async () => {
    const nonce = await pool.nonces(user.address);
    await claimReward(user.address, WAD, 100, nonce);
    expect(await pool.nonces(user.address)).gt(nonce);

    await expect(claimReward(user.address, WAD, 100, nonce)).to.be.revertedWith('INVALID_SIGNATURE');
  });

  it('Should not claim past deadline', async () => {
    await expect(claimReward(user.address, WAD, -1)).to.be.revertedWith('INVALID_TIME');
    await claimReward(user.address, WAD, 1);
  });

  it('Should not claim by another user, value or deadline', async () => {
    const params = buildRewardClaimPermitParams(domainParams, {
      provider: deployer.address,
      spender: user.address,
      value: WAD,
      nonce: await pool.nonces(user.address),
      deadline: (await currentTick()) + 10,
    });

    const signature = await deployer._signTypedData(params.domain, params.types, params.message!);
    const { v, r, s } = splitSignature(signature);

    const m = params.message;

    await expect(pool.claimRewardByPermit(user2.address, m.spender, m.value, m.deadline, v, r, s)).to.be.revertedWith(
      'INVALID_PROVIDER'
    );
    await expect(pool.claimRewardByPermit(m.provider, user2.address, m.value, m.deadline, v, r, s)).to.be.revertedWith(
      'INVALID_SIGNATURE'
    );
    await expect(pool.claimRewardByPermit(m.provider, user2.address, 1, m.deadline, v, r, s)).to.be.revertedWith(
      'INVALID_SIGNATURE'
    );
    await expect(
      pool.claimRewardByPermit(m.provider, m.spender, m.value, (await currentTick()) + 10000, v, r, s)
    ).to.be.revertedWith('INVALID_SIGNATURE');
  });

  it('Should claim reward gradually', async () => {
    {
      const rewards = await rewardCtl.claimableReward(user.address);
      expect(rewards.claimable.add(rewards.extra)).to.eq(0);
    }

    await pool.setMeltDownAt((await currentTick()) + 100);
    const startedAt = (await currentTick()) + 1;
    await claimReward(user.address, 100);

    for (const delta of [1, 5, 10, 23]) {
      await mineTicks(delta);
      const rewards = await rewardCtl.claimableReward(user.address);

      expect(rewards.claimable).eq((await currentTick()) - startedAt);
      expect(rewards.claimable.add(rewards.extra)).to.eq(100);
    }
    await mineTicks(100);

    {
      const rewards = await rewardCtl.claimableReward(user.address);
      expect(rewards.claimable).eq(100);
      expect(rewards.extra).to.eq(0);
    }
  });
});
