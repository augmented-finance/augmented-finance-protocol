import { getParamPerNetwork } from '../../helpers/contracts-helpers';
import { loadPoolConfig } from '../../helpers/configuration';
import {
  deployTokenWeightedRewardPoolImpl,
  deployTeamRewardPool,
  deployNamedPermitFreezerRewardPool,
  deployReferralRewardPoolV1Impl,
  deployTreasuryRewardPool,
} from '../../helpers/contracts-deployments';
import {
  tEthereumAddress,
  ICommonConfiguration,
  ITokenRewardPoolParams,
  IRewardPoolParams,
  IPermiRewardPool,
  IRewardPools,
} from '../../helpers/types';
import {
  getLendingPoolProxy,
  getRewardConfiguratorProxy,
  getStakeConfiguratorImpl,
  getRewardBooster,
  getIManagedRewardPool,
  getIInitializableRewardPool,
} from '../../helpers/contracts-getters';
import { addProxyToJsonDb, chunk, falsyOrZeroAddress, mustWaitTx } from '../../helpers/misc-utils';
import { AccessFlags } from '../../helpers/access-flags';
import { BigNumber } from 'ethers';
import { oneWad, ZERO_ADDRESS } from '../../helpers/constants';
import { transpose } from 'underscore';
import { getDeployAccessController, setAndGetAddressAsProxyWithInit } from '../../helpers/deploy-helpers';
import { MarketAccessController, RewardBooster, RewardConfigurator } from '../../types';
import { deployTask } from '../helpers/deploy-steps';
import { getUniAgfEth } from '../../helpers/init-helpers';

interface poolInitParams {
  provider: tEthereumAddress;
  impl: tEthereumAddress;
  poolName: string;
  baselinePercentage: BigNumber;
  initialRate: BigNumber;
  boostFactor: BigNumber;
}

deployTask(`full:init-reward-pools`, `Deploy reward pools`, __dirname).setAction(async ({ verify, pool }, localBRE) => {
  await localBRE.run('set-DRE');
  const poolConfig = loadPoolConfig(pool);

  const [freshStart, continuation, addressProvider] = await getDeployAccessController();

  const { ReserveAssets, RewardParams, Names, Dependencies, AGF } = poolConfig as ICommonConfiguration;

  const reserveAssets = getParamPerNetwork(ReserveAssets);
  const { UniV2EthPair } = getParamPerNetwork(AGF);
  const stakeConfigurator = await getStakeConfiguratorImpl(
    await addressProvider.getAddress(AccessFlags.STAKE_CONFIGURATOR)
  );

  const lendingPool = await getLendingPoolProxy(await addressProvider.getLendingPool());
  const rewardParams = getParamPerNetwork(RewardParams.RewardPools);
  const initialRateWad = rewardParams.InitialRateWad;

  const knownReserves: {
    baseSymbol: string;
    tokens: tEthereumAddress[];
    shares: (IRewardPoolParams | undefined)[];
  }[] = [];

  for (const [sym, opt] of Object.entries(rewardParams.TokenPools)) {
    if (opt == undefined) {
      continue;
    }
    const tp: ITokenRewardPoolParams = opt;

    const asset = reserveAssets[sym];
    if (falsyOrZeroAddress(asset)) {
      console.log('Reward asset (underlying) is missing:', sym);
      continue;
    }

    const rd = await lendingPool.getReserveData(asset);
    if (falsyOrZeroAddress(rd.depositTokenAddress)) {
      console.log('Reserve is missing for asset (underlying):', sym);
      continue;
    }

    const info = {
      baseSymbol: sym,
      tokens: [rd.depositTokenAddress, rd.variableDebtTokenAddress, rd.stableDebtTokenAddress],
      shares: [tp.Share.deposit, tp.Share.vDebt, tp.Share.sDebt],
    };
    if (tp.Share.stake != undefined) {
      info.tokens.push(await stakeConfigurator.stakeTokenOf(rd.depositTokenAddress));
      info.shares.push(tp.Share.stake);
    }
    knownReserves.push(info);
  }

  if (UniV2EthPair?.StakeToken?.RewardShare) {
    const dependencies = getParamPerNetwork(Dependencies);
    const priceBaseSymbol = dependencies.AgfPair ?? dependencies.WrappedNative ?? 'WETH';
    const pairPriceBaseToken = reserveAssets[priceBaseSymbol];
    const lpPairAddr = await getUniAgfEth(addressProvider, dependencies.UniswapV2Router, pairPriceBaseToken);

    if (!falsyOrZeroAddress(lpPairAddr)) {
      knownReserves.push({
        baseSymbol: UniV2EthPair.Symbol,
        tokens: ['', '', '', await stakeConfigurator.stakeTokenOf(lpPairAddr)],
        shares: [undefined, undefined, undefined, UniV2EthPair.StakeToken.RewardShare],
      });
    }
  }

  const prepParams: poolInitParams[] = [];
  const prepNames: string[] = [];
  const prepProviders: tEthereumAddress[] = [];

  {
    const subTypePrefixes: string[] = [
      Names.DepositSymbolPrefix,
      Names.VariableDebtSymbolPrefix,
      Names.StableDebtSymbolPrefix,
      Names.StakeSymbolPrefix,
    ];

    // Put the most frequently used token types at the beginning
    for (const subType of [0, 1, 3, 2]) {
      // Deposit, Variable, Stake, Stable
      for (const knownReserve of knownReserves) {
        const token = knownReserve.tokens[subType];
        const share = knownReserve.shares[subType];
        if (share == undefined || falsyOrZeroAddress(token)) {
          continue;
        }
        const tokenSymbol = subTypePrefixes[subType] + Names.SymbolPrefix + knownReserve.baseSymbol;
        prepNames.push(tokenSymbol);
        prepProviders.push(token);
        prepParams.push({
          provider: token,
          baselinePercentage: BigNumber.from(share.BasePoints),
          poolName: tokenSymbol,
          initialRate: BigNumber.from(0),
          boostFactor: BigNumber.from(share!.BoostFactor),
          impl: '',
        });
      }
    }
  }

  const rewardController = await getRewardBooster(await addressProvider.getAddress(AccessFlags.REWARD_CONTROLLER));
  const configurator = await getRewardConfiguratorProxy(
    await addressProvider.getAddress(AccessFlags.REWARD_CONFIGURATOR)
  );

  const { pools, controllers } = await configurator.getRewardedTokenParams(prepProviders);

  const initParams: poolInitParams[] = [];
  const initNames: string[] = [];

  let poolImplAddr: tEthereumAddress = ZERO_ADDRESS;

  for (let i = 0; i < prepParams.length; i++) {
    const poolParams = prepParams[i];
    if (falsyOrZeroAddress(pools[i])) {
      // a separate pool should be created and connected
      if (falsyOrZeroAddress(poolImplAddr)) {
        const poolImpl = await deployTokenWeightedRewardPoolImpl(verify, continuation);
        poolImplAddr = poolImpl.address;
      }
      poolParams.impl = poolImplAddr;
    } else if (falsyOrZeroAddress(controllers[i])) {
      // a self-pool should be initialized, but not created
      poolParams.impl = ZERO_ADDRESS;
    } else {
      console.log('Token has an active reward pool already:', prepNames[i], pools[i]);
      continue;
    }
    initParams.push(poolParams);
    initNames.push(prepNames[i]);
  }

  let totalShare = 0;
  let newPoolsOffset = 0;
  const newNames: string[] = [];
  if (!freshStart || continuation) {
    const totals = await configurator.getPoolTotals(true);
    // console.log('Existing pool totals: ', totals);
    totalShare += totals.totalBaselinePercentage.toNumber();
    newPoolsOffset = totals.listCount.toNumber();
  }
  if (freshStart && newPoolsOffset <= 1) {
    newPoolsOffset = 0;
    newNames.push(Names.RewardStakeTokenSymbol);
  }

  const [extraNames, extraShare] = await deployExtraPools(
    addressProvider,
    freshStart,
    continuation,
    rewardParams,
    configurator,
    rewardController.address,
    verify
  );
  totalShare += extraShare;

  for (const params of initParams) {
    totalShare += params.baselinePercentage.toNumber();
  }

  console.log(`Total reward share: ${(0.0 + totalShare) / 100.0}%`);
  if (totalShare > 10000) {
    throw `excessive total reward share`;
  }

  // CHUNK CONFIGURATION
  const initChunks = 4;

  const chunkedParams = chunk(initParams, initChunks);
  const chunkedNames = chunk(initNames, initChunks);

  console.log(`- Reward pools initialization with ${chunkedParams.length} txs`);
  for (let chunkIndex = 0; chunkIndex < chunkedParams.length; chunkIndex++) {
    const param = chunkedParams[chunkIndex];
    // console.log(param);
    const tx3 = await mustWaitTx(
      configurator.batchInitRewardPools(param, {
        gasLimit: 5000000,
      })
    );

    console.log(`  - Pool(s) ready for: ${chunkedNames[chunkIndex].join(', ')}`);
    console.log('    * gasUsed', tx3.gasUsed.toString());
  }

  const activePools = await configurator.list();

  if (verify) {
    console.log('Collecting verification data for reward pools');
    for (let i = 0; i < initParams.length; i++) {
      const params = initParams[i];
      if (falsyOrZeroAddress(params.impl)) {
        continue;
      }
      const proxyAddr = activePools[activePools.length - (initParams.length - i)]; // new pools are at the end of all pools
      const implAddr = params.impl;
      console.log('\t', params.poolName, proxyAddr, implAddr);

      const v = await getIInitializableRewardPool(proxyAddr);
      const data = v.interface.encodeFunctionData('initializeRewardPool', [
        {
          controller: configurator.address,
          poolName: params.poolName,
          baselinePercentage: params.baselinePercentage,
        },
      ]);
      await addProxyToJsonDb('REWARD_POOL_' + params.poolName, proxyAddr, implAddr, 'rewardPool', [
        configurator.address,
        implAddr,
        data,
      ]);
    }
  }

  newNames.push(...extraNames);
  newNames.push(...initNames);

  await updateRates(rewardController, activePools, initialRateWad, newNames, newPoolsOffset);
});

const updateRates = async (
  rewardController: RewardBooster,
  activePools: string[],
  initialRateWad: number,
  newNames: string[],
  newPoolsOffset: number
) => {
  const initialRate = BigNumber.from(oneWad.multipliedBy(initialRateWad).toFixed(0));
  await mustWaitTx(rewardController.updateBaseline(initialRate));

  console.log(`Reward pools initialized with total rate: ${initialRateWad} wad/s`);

  if (newNames.length + newPoolsOffset != activePools.length) {
    console.log(
      `Different number of reward pools. Expected ${newNames.length} + ${newPoolsOffset}, actual ${activePools.length}`
    );
    console.log('Actual reward pools: ', activePools);
  } else {
    let totalRate = BigNumber.from(0);

    console.log(`Rates of ${newNames.length} reward pools configured:`);
    let index = 0;
    for (const poolAddr of activePools.slice(newPoolsOffset)) {
      const pool = await getIManagedRewardPool(poolAddr);
      const poolRate = await pool.getRate();

      totalRate = totalRate.add(poolRate);
      console.log(`\t${newNames[index]}:\t${poolRate.div(1e9).toNumber() / 1e9} wad/s`);
      index++;
    }
    console.log(`Assigned reward rate: ${totalRate.div(1e9).toNumber() / 1e9} wad/s`);
    console.log(`Initial reward rate:  ${initialRate.div(1e9).toNumber() / 1e9} wad/s`);
  }
};

const deployExtraPools = async (
  addressProvider: MarketAccessController,
  freshStart: boolean,
  continuation: boolean,
  rewardParams: IRewardPools,
  configurator: RewardConfigurator,
  rewardCtlAddress: tEthereumAddress,
  verify: boolean
): Promise<[string[], number]> => {
  const knownNamedPools = new Set<string>();
  const teamPoolName = 'TeamPool'; // NB! it is constant in a contract
  const refPoolName = 'RefPool';
  const burnPoolName = 'BurnersPool';
  const retroPoolName = 'RetroPool';
  const treasuryPoolName = 'TreasuryPool'; // NB! it is constant in a contract

  let totalShare = 0;
  const extraNames: string[] = [];

  if (!freshStart || continuation) {
    const allNames = [teamPoolName, refPoolName, burnPoolName, retroPoolName, treasuryPoolName];
    const allNamed = await configurator.getNamedRewardPools(allNames);
    for (let i = 0; i < allNamed.length; i++) {
      if (!falsyOrZeroAddress(allNamed[i])) {
        knownNamedPools.add(allNames[i]);
      }
    }
    console.log('Known named pools: ', knownNamedPools);
  }

  if (rewardParams.TeamPool && !knownNamedPools.has(teamPoolName)) {
    const poolName = teamPoolName;
    const params = rewardParams.TeamPool;

    extraNames.push(poolName);
    totalShare += params.BasePoints;
    const trp = await deployTeamRewardPool([rewardCtlAddress, 0, params.BasePoints, params.Manager], verify);

    const unlockTimestamp = (params.UnlockAt.getTime() / 1000) | 0;
    let memberAddresses: tEthereumAddress[] = [];
    let memberShares: number[] = [];

    const members = Object.entries(params.Members);
    if (members.length > 0) {
      [memberAddresses, memberShares] = transpose(members);
    }

    await mustWaitTx(
      configurator.configureTeamRewardPool(trp.address, poolName, unlockTimestamp, memberAddresses, memberShares)
    );

    const allocation = await trp.getAllocatedShares();
    console.log(
      `Deployed ${poolName}: ${trp.address}, allocation ${allocation / 100.0}%, ${
        members.length
      } member(s), unlocks at ${params.UnlockAt} (${unlockTimestamp})`
    );
  }

  const poolAddrs: tEthereumAddress[] = [];
  const poolNames: string[] = [];
  const poolFactors: number[] = [];

  if (rewardParams.ReferralPool && !knownNamedPools.has(refPoolName)) {
    const poolName = refPoolName;
    const params = rewardParams.ReferralPool;

    const baselinePct = params.BasePoints;
    totalShare += baselinePct;

    let poolAddr = await addressProvider.getAddress(AccessFlags.REFERRAL_REGISTRY);
    if (falsyOrZeroAddress(poolAddr)) {
      const impl = await deployReferralRewardPoolV1Impl(verify, continuation);
      console.log(`Deployed ${poolName} implementation: `, impl.address);

      const initData = await configurator.buildRewardPoolInitData(poolName, baselinePct);
      poolAddr = await setAndGetAddressAsProxyWithInit(
        addressProvider,
        AccessFlags.REFERRAL_REGISTRY,
        impl.address,
        initData
      );
    }
    console.log(`Deployed ${poolName}: `, poolAddr);

    poolAddrs.push(poolAddr);
    poolNames.push(poolName);
    poolFactors.push(params.BoostFactor);
  }

  if (rewardParams.TreasuryPool && !knownNamedPools.has(treasuryPoolName)) {
    const poolName = treasuryPoolName;
    const params = rewardParams.TreasuryPool;

    const baselinePct = params.BasePoints;
    totalShare += baselinePct;

    const impl = await deployTreasuryRewardPool([rewardCtlAddress, 0, baselinePct], verify);
    console.log(`Deployed ${poolName}: `, impl.address);

    poolAddrs.push(impl.address);
    poolNames.push(poolName);
    poolFactors.push(params.BoostFactor);
  }

  const deployPermitPool = async (poolName: string, params?: IPermiRewardPool) => {
    if (!params || params.TotalWad == 0 || knownNamedPools.has(poolName)) {
      return;
    }

    const unlockTimestamp = (params.MeltDownAt.getTime() / 1000) | 0;

    const brp = await deployNamedPermitFreezerRewardPool(
      poolName,
      [rewardCtlAddress, oneWad.multipliedBy(params.TotalWad).toFixed(), unlockTimestamp],
      verify
    );

    if (params.Providers.length > 0) {
      console.log(`Adding providers to ${poolName}: ${params.Providers.length}`);
      for (const value of params.Providers) {
        if (!falsyOrZeroAddress(value)) {
          await mustWaitTx(brp.addRewardProvider(value, ZERO_ADDRESS));
        }
      }
    }

    poolAddrs.push(brp.address);
    poolNames.push(poolName);
    poolFactors.push(params.BoostFactor);

    console.log(
      `Deployed ${poolName}: ${brp.address}, limit ${params.TotalWad} wad, melts at ${params.MeltDownAt} (${unlockTimestamp})`
    );
  };

  await deployPermitPool(burnPoolName, rewardParams.BurnersPool);
  await deployPermitPool(retroPoolName, rewardParams.RetroPool);

  if (poolAddrs.length > 0) {
    await mustWaitTx(configurator.addNamedRewardPools(poolAddrs, poolNames, poolFactors));

    console.log(`Deployed ${poolNames.join(', ')}: ${poolAddrs}`);
    extraNames.push(...poolNames);
  }

  return [extraNames, totalShare];
};
