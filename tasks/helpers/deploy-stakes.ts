import { BigNumber } from 'ethers';
import { task } from 'hardhat/config';
import { AccessFlags } from '../../helpers/access-flags';
import { WAD, ZERO_ADDRESS } from '../../helpers/constants';
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
import { falsyOrZeroAddress, getFirstSigner, mustWaitTx, sleep } from '../../helpers/misc-utils';
import { MarketAccessController } from '../../types';

task('helper:deploy-stakes', 'Deploy post-ELM stakes').setAction(async (DRE) => {
  const deployer = await getFirstSigner();
  const ac = await getMarketAccessController('0x68729F101B91fD8Fe7A95E8e7A653905B6F3838a');

  console.log('setTemporaryAdmin');
  await mustWaitTx(ac.setTemporaryAdmin(deployer.address, 1000));
  console.log('grantRoles');
  await mustWaitTx(
    ac.grantRoles(
      deployer.address,
      AccessFlags.STAKE_ADMIN | AccessFlags.REWARD_CONFIG_ADMIN | AccessFlags.REWARD_RATE_ADMIN
    )
  );

  await deployFreshStakes(ac);

  console.log('renounceTemporaryAdmin');
  await mustWaitTx(ac.renounceTemporaryAdmin());
});

const deployFreshStakes = async (ac: MarketAccessController) => {
  const rc = await getRewardBooster(await ac.getAddress(AccessFlags.REWARD_CONTROLLER));
  const sc = await getStakeConfiguratorImpl(await ac.getAddress(AccessFlags.STAKE_CONFIGURATOR));
  const rwCfg = await getRewardConfiguratorProxy(await ac.getAddress(AccessFlags.REWARD_CONFIGURATOR));

  const depositSet = new Set<string>();
  {
    const lp = await getLendingPoolProxy(await ac.getLendingPool());
    for (const asset of await lp.getReservesList()) {
      const data = await lp.getReserveData(asset);
      if (falsyOrZeroAddress(data.depositTokenAddress)) {
        continue;
      }
      depositSet.add(data.depositTokenAddress.toLowerCase());
    }
  }

  const stakeParams: {
    stakeTokenImpl: string;
    stakedToken: string;
    strategy: string;
    stkTokenName: string;
    stkTokenSymbol: string;
    cooldownPeriod: BigNumber;
    unstakePeriod: BigNumber;
    stkTokenDecimals: number;
    maxSlashable: number;
    depositStake: boolean;
  }[] = [];

  const poolParams: {
    provider: string;
    baselinePercentage: number;
    poolName: string;
    initialRate: number;
    boostFactor: number;
    impl: string;
  }[] = [];

  let stakeTokenImpl = '0x23Cf84a21E0482a386AaA4ebF5c5730Ca6859344'; // kovan
  let depositStakeTokenImpl = '0x384459b8E827F7e5882EEe6Ce5a1CA217a9F2939'; // kovan

  const getStakeImpl = async (deposit: boolean) => {
    if (deposit) {
      if (falsyOrZeroAddress(depositStakeTokenImpl)) {
        const impl = await deployDepositStakeTokenImpl(true, false);
        depositStakeTokenImpl = impl.address;
        console.log('DepositStakeTokenImpl', impl.address);
      }
      return depositStakeTokenImpl;
    } else {
      if (falsyOrZeroAddress(stakeTokenImpl)) {
        const impl = await deployStakeTokenImpl(true, false);
        stakeTokenImpl = impl.address;
        console.log('StakeTokenImpl', impl.address);
      }
      return stakeTokenImpl;
    }
  };

  const stakeList = await sc.listAll();
  const oldStakeCount = stakeList.genCount.toNumber();
  const cleanupUnderlyings: string[] = [];
  const oldTokens: string[] = [];
  const names: string[] = [];

  console.log('Found', oldStakeCount, 'stake token(s) from ELM');
  for (const oldStakeAddr of stakeList.tokens.slice(0, oldStakeCount)) {
    if (falsyOrZeroAddress(oldStakeAddr)) {
      continue;
    }
    const oldStake = await getStakeTokenImpl(oldStakeAddr);
    const underlying = await oldStake.UNDERLYING_ASSET_ADDRESS();
    if (falsyOrZeroAddress(oldStakeAddr)) {
      console.log('missign underlying for:', oldStakeAddr);
      continue;
    }
    {
      const currentAddr = await sc.stakeTokenOf(underlying);
      if (!falsyOrZeroAddress(currentAddr)) {
        if (currentAddr != oldStakeAddr) {
          console.log('Already substituted:', oldStakeAddr, currentAddr);
          continue;
        }
        cleanupUnderlyings.push(underlying);
      }
    }

    const stkSymbol = await oldStake.symbol();
    const isDeposit = depositSet.has(underlying.toLowerCase());

    console.log(isDeposit ? '\tDeposit stake:' : '\tStake:', stkSymbol, oldStakeAddr);

    oldTokens.push(oldStakeAddr);
    names.push(stkSymbol);

    stakeParams.push({
      stakeTokenImpl: await getStakeImpl(isDeposit),
      stakedToken: underlying,
      strategy: ZERO_ADDRESS,
      stkTokenName: await oldStake.name(),
      stkTokenSymbol: stkSymbol,
      cooldownPeriod: await oldStake.COOLDOWN_PERIOD(),
      unstakePeriod: await oldStake.UNSTAKE_PERIOD(),
      stkTokenDecimals: await oldStake.decimals(),
      maxSlashable: await oldStake.getMaxSlashablePercentage(),
      depositStake: isDeposit,
    });

    poolParams.push({
      provider: '', // newUniStakeAddr,
      baselinePercentage: await oldStake.getBaselinePercentage(),
      poolName: stkSymbol,
      initialRate: 0,
      boostFactor: await rc.getBoostFactor(oldStakeAddr),
      impl: ZERO_ADDRESS,
    });
  }

  console.log('Release underlyings:', cleanupUnderlyings.length);
  if (cleanupUnderlyings.length > 0) {
    await mustWaitTx(
      sc.removeUnderlyings(cleanupUnderlyings, {
        gasLimit: 1000000,
      })
    );
  }

  console.log('Init new stake tokens:', stakeParams.length);

  console.log('New stake tokens: ', stakeParams);
  console.log('New stake rewards: ', poolParams);

  await mustWaitTx(
    sc.batchInitStakeTokens(stakeParams, {
      gasLimit: 5000000,
    })
  );

  console.log('Get new stake tokens:', stakeParams.length);
  for (let i = 0; i < stakeParams.length; i++) {
    while (true) {
      const newAddr = await sc.stakeTokenOf(stakeParams[i].stakedToken);
      if (newAddr == oldTokens[i]) {
        console.log('\t...waiting for update');
        await sleep(2000);
        continue;
      }

      console.log('\t', names[i], oldTokens[i], '=>', newAddr);
      poolParams[i].provider = newAddr;
      break;
    }
  }

  console.log('New stake rewards: ', poolParams);
  console.log('Add new stake pools:', poolParams.length);
  await mustWaitTx(
    rwCfg.batchInitRewardPools(poolParams, {
      gasLimit: 5000000,
    })
  );

  await mustWaitTx(rc.updateBaseline(WAD));
};

const deployImpls = async (ac: MarketAccessController) => {
  {
    const impl = await deployRewardConfiguratorImpl(true, false);
    console.log('RewardConfiguratorImpl', impl.address);
    // const tx = await ac.setAddressAsProxy(AccessFlags.REWARD_CONFIGURATOR, impl.address);
    // console.log(tx.hash);
  }
  {
    const impl = await deployStakeConfiguratorImpl(true, false);
    console.log('StakeConfiguratorImpl', impl.address);
    // const tx = await ac.setAddressAsProxy(AccessFlags.STAKE_CONFIGURATOR, impl.address);
    // console.log(tx.hash);
  }
  {
    const impl = await deployProtocolDataProvider(ac.address, true);
    console.log('ProtocolDataProvider', impl.address);
    // const tx = await ac.setAddress(AccessFlags.DATA_HELPER, impl.address);
    // console.log(tx.hash);
  }

  {
    const impl = await deployDepositStakeTokenImpl(true, false);
    console.log('DepositStakeTokenImpl', impl.address);
  }

  {
    const impl = await deployStakeTokenImpl(true, false);
    console.log('StakeTokenImpl', impl.address);
  }
};

const deployUni = async () => {
  // {
  //   const impl = await deployRewardConfiguratorImpl(true, false);
  //   console.log(impl.address);
  //   const tx = await ac.setAddressAsProxy(AccessFlags.REWARD_CONFIGURATOR, impl.address);
  //   console.log(tx.hash);
  // }
  // {
  //   const impl = await deployStakeConfiguratorImpl(true, false);
  //   console.log(impl.address);
  //   const tx = await ac.setAddressAsProxy(AccessFlags.STAKE_CONFIGURATOR, impl.address);
  //   console.log(tx.hash);
  // }
  // {
  //   const impl = await deployProtocolDataProvider(ac.address, true);
  //   console.log(impl.address);
  //   const tx = await ac.setAddress(AccessFlags.DATA_HELPER, impl.address);
  //   console.log(tx.hash);
  // }
  // {
  //   const rc = await getRewardBooster(await ac.getAddress(AccessFlags.REWARD_CONTROLLER));
  //   const sc = await getStakeConfiguratorImpl(await ac.getAddress(AccessFlags.STAKE_CONFIGURATOR));
  //   const rwCfg = await getRewardConfiguratorProxy(await ac.getAddress(AccessFlags.REWARD_CONFIGURATOR));
  //   const uniToken = '0xe46b8f6fec966e5eb6fc505f0504192c16b13db7';
  //   const uniStakeAddr = '0x9E9275d697e67D5CEF737126C8730427BD73a59a'; // await sc.stakeTokenOf(uniToken);
  //   if (falsyOrZeroAddress(uniStakeAddr)) {
  //     throw new Error('missing stake token');
  //   }
  //   const uniStake = await getStakeTokenImpl(uniStakeAddr);
  //   const rev = (await uniStake.REVISION()).toNumber();
  //   if (rev > 1) {
  //     console.log('Found stake revision:', rev);
  //   } else {
  //     let stakeParams = {
  //       stakeTokenImpl: ZERO_ADDRESS,
  //       stakedToken: uniToken,
  //       strategy: ZERO_ADDRESS,
  //       stkTokenName: await uniStake.name(),
  //       stkTokenSymbol: await uniStake.symbol(),
  //       cooldownPeriod: await uniStake.COOLDOWN_PERIOD(),
  //       unstakePeriod: await uniStake.UNSTAKE_PERIOD(),
  //       stkTokenDecimals: await uniStake.decimals(),
  //       maxSlashable: await uniStake.getMaxSlashablePercentage(),
  //       depositStake: false,
  //     };
  //     let poolParams = {
  //       provider: '', // newUniStakeAddr,
  //       baselinePercentage: await uniStake.getBaselinePercentage(),
  //       poolName: stakeParams.stkTokenSymbol,
  //       initialRate: 0,
  //       boostFactor: await rc.getBoostFactor(uniStakeAddr),
  //       impl: ZERO_ADDRESS,
  //     };
  //     // console.log('setTemporaryAdmin');
  //     // await mustWaitTx(ac.setTemporaryAdmin(deployer.address, 1000));
  //     console.log('grantRoles');
  //     await mustWaitTx(ac.grantRoles(deployer.address, AccessFlags.STAKE_ADMIN | AccessFlags.REWARD_CONFIG_ADMIN | AccessFlags.REWARD_RATE_ADMIN));
  //     // const impl = await deployStakeTokenImpl(true, false);
  //     stakeParams.stakeTokenImpl = '0xE266F93E4923440D3A7e0d79CD220515323a3c40'; // impl.address;
  //     console.log('stake', stakeParams);
  //     let newUniStakeAddr = '0x19ef115Bd70b6E2d64c776809328260383E3Ef8D';
  //     // if (falsyOrZeroAddress(newUniStakeAddr)) {
  //     //   await mustWaitTx(sc.removeUnderlyings([uniToken]));
  //     //   console.log('Create new stake token');
  //     //   await mustWaitTx(sc.batchInitStakeTokens([stakeParams], {
  //     //     gasLimit: 2000000,
  //     //   }));
  //     //   console.log('Wait for the new token');
  //     //   while (true) {
  //     //     newUniStakeAddr = await sc.stakeTokenOf(uniToken);
  //     //     if (newUniStakeAddr != uniStakeAddr) {
  //     //       break;
  //     //     }
  //     //     console.log('... waiting', newUniStakeAddr);
  //     //     await sleep(2000);
  //     //   }
  //     // }
  //     // console.log('New stake', newUniStakeAddr);
  //     // poolParams.provider = newUniStakeAddr;
  //     // console.log('pool', poolParams);
  //     // console.log('Add new stake pool');
  //     // await mustWaitTx(rwCfg.batchInitRewardPools([poolParams], {
  //     //   gasLimit: 2000000,
  //     // }));
  //     await mustWaitTx(rc.updateBaseline(0));
  //     await mustWaitTx(rc.removeRewardPool(uniStakeAddr));
  //     await mustWaitTx(rc.updateBaseline(WAD));
  //     console.log('renounceTemporaryAdmin');
  //     await mustWaitTx(ac.renounceTemporaryAdmin());
  //   }
  // }
};
