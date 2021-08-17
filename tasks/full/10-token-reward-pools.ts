import { task } from 'hardhat/config';
import { getParamPerNetwork } from '../../helpers/contracts-helpers';
import { loadPoolConfig, ConfigNames } from '../../helpers/configuration';
import {
  deployTokenWeightedRewardPoolImpl,
  deployTeamRewardPool,
  deployNamedPermitFreezerRewardPool,
  deployReferralRewardPoolV1Impl,
  deployTreasuryRewardPool,
} from '../../helpers/contracts-deployments';
import {
  tEthereumAddress,
  eNetwork,
  ICommonConfiguration,
  ITokenRewardPoolParams,
  IRewardPoolParams,
  IRewardParams,
} from '../../helpers/types';
import {
  getLendingPoolProxy,
  getRewardConfiguratorProxy,
  getStakeConfiguratorImpl,
  getRewardBooster,
  getIManagedRewardPool,
  getIRewardedToken,
} from '../../helpers/contracts-getters';
import { chunk, falsyOrZeroAddress, getFirstSigner, mustWaitTx, waitTx } from '../../helpers/misc-utils';
import { AccessFlags } from '../../helpers/access-flags';
import { BigNumber } from 'ethers';
import { oneWad, ZERO_ADDRESS } from '../../helpers/constants';
import { transpose } from 'underscore';
import { getDeployAccessController, setAndGetAddressAsProxyWithInit } from '../../helpers/deploy-helpers';
import { MarketAccessController, RewardConfigurator } from '../../types';

interface poolInitParams {
  provider: tEthereumAddress;
  impl: tEthereumAddress;
  poolName: string;
  baselinePercentage: BigNumber;
  initialRate: BigNumber;
  boostFactor: BigNumber;
}

task(`full:init-reward-pools`, `Deploys reward pools`)
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addFlag('verify', `Verify contracts via Etherscan API.`)
  .setAction(async ({ verify, pool }, localBRE) => {
    await localBRE.run('set-DRE');
    const network = <eNetwork>localBRE.network.name;
    const poolConfig = loadPoolConfig(pool);

    const [freshStart, continuation, addressProvider] = await getDeployAccessController();

    const { ReserveAssets, RewardParams, Names } = poolConfig as ICommonConfiguration;

    const reserveAssets = getParamPerNetwork(ReserveAssets, network);
    const stakeConfigurator = await getStakeConfiguratorImpl(
      await addressProvider.getAddress(AccessFlags.STAKE_CONFIGURATOR)
    );

    await waitTx(
      addressProvider.grantRoles(
        (
          await getFirstSigner()
        ).address,
        AccessFlags.REWARD_CONFIG_ADMIN | AccessFlags.REWARD_RATE_ADMIN
      )
    );

    const poolImpl = await deployTokenWeightedRewardPoolImpl(verify, continuation);
    const lendingPool = await getLendingPoolProxy(await addressProvider.getLendingPool());

    let initParams: poolInitParams[] = [];
    let initNames: string[] = [];

    const buildPool = async (
      share: IRewardPoolParams,
      provider: tEthereumAddress,
      impl: tEthereumAddress,
      name: string,
      poolName: string
    ) => {
      initParams.push({
        provider: provider,
        baselinePercentage: BigNumber.from(share.BasePoints),
        poolName: poolName,
        initialRate: BigNumber.from(0),
        boostFactor: BigNumber.from(share!.BoostFactor),
        impl: impl,
      });
      initNames.push(name);
    };

    let symbol: string;

    const buildToken = async (share: IRewardPoolParams | undefined, token: tEthereumAddress, prefix: string) => {
      if (share == undefined || falsyOrZeroAddress(token)) {
        return;
      }
      const tokenSymbol = prefix + Names.SymbolPrefix + symbol;
      if (!freshStart || continuation) {
        const rewardedToken = await getIRewardedToken(token);
        const ctl = await rewardedToken.getIncentivesController();
        if (!falsyOrZeroAddress(ctl)) {
          console.log('Token has a reward pool already:', tokenSymbol, ctl);
          return;
        }
      }
      buildPool(share!, token, poolImpl.address, tokenSymbol, '');
    };

    const rewardParams = RewardParams; // getParamPerNetwork(RewardParams, network);

    const rewardController = await getRewardBooster(await addressProvider.getAddress(AccessFlags.REWARD_CONTROLLER));
    const configurator = await getRewardConfiguratorProxy(
      await addressProvider.getAddress(AccessFlags.REWARD_CONFIGURATOR)
    );

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

    for (const [sym, opt] of Object.entries(rewardParams.TokenPools)) {
      if (opt == undefined) {
        continue;
      }
      const tp: ITokenRewardPoolParams = opt;
      symbol = sym;

      const asset = reserveAssets[symbol];
      if (falsyOrZeroAddress(asset)) {
        console.log('Reward asset (underlying) is missing:', symbol);
        continue;
      }

      const rd = await lendingPool.getReserveData(asset);
      if (falsyOrZeroAddress(rd.depositTokenAddress)) {
        console.log('Reserve is missing for asset (underlying):', symbol);
        continue;
      }

      await buildToken(tp.Share.deposit, rd.depositTokenAddress, Names.DepositSymbolPrefix);
      await buildToken(tp.Share.vDebt, rd.variableDebtTokenAddress, Names.VariableDebtSymbolPrefix);
      await buildToken(tp.Share.sDebt, rd.stableDebtTokenAddress, Names.StableDebtSymbolPrefix);

      if (tp.Share.stake != undefined) {
        await buildToken(
          tp.Share.stake,
          await stakeConfigurator.stakeTokenOf(rd.depositTokenAddress),
          Names.StakeSymbolPrefix
        );
      }
    }

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

    newNames.push(...extraNames);
    newNames.push(...initNames);

    const initialRate = BigNumber.from(oneWad.multipliedBy(rewardParams.InitialRateWad).toFixed());
    await mustWaitTx(rewardController.updateBaseline(initialRate));

    console.log(`Reward pools initialized with total rate: ${rewardParams.InitialRateWad} wad/s`);
    const activePools = await configurator.list();

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
  });

const deployExtraPools = async (
  addressProvider: MarketAccessController,
  freshStart: boolean,
  continuation: boolean,
  rewardParams: IRewardParams,
  configurator: RewardConfigurator,
  rewardCtlAddress: tEthereumAddress,
  verify: boolean
): Promise<[string[], number]> => {
  const knownNamedPools = new Set<string>();
  const teamPoolName = 'TeamPool'; // NB! it is constant in a contract
  const refPoolName = 'RefPool';
  const burnPoolName = 'BurnersPool';
  const treasuryPoolName = 'TreasuryPool'; // NB! it is constant in a contract

  let totalShare: number = 0;
  const extraNames: string[] = [];

  if (!freshStart || continuation) {
    const allNames = [teamPoolName, refPoolName, burnPoolName, treasuryPoolName];
    const allNamed = await configurator.getNamedRewardPools(allNames);
    for (let i = 0; i < allNamed.length; i++) {
      if (!falsyOrZeroAddress(allNamed[i])) {
        knownNamedPools.add(allNames[i]);
      }
    }
    console.log('Known named pools: ', knownNamedPools);
  }

  if (!knownNamedPools.has(teamPoolName)) {
    const poolName = teamPoolName;
    const params = rewardParams.TeamPool;

    extraNames.push(poolName);
    totalShare += params.BasePoints;
    const trp = await deployTeamRewardPool([rewardCtlAddress, 0, params.BasePoints, params.Manager], verify);

    const unlockTimestamp = (params.UnlockAt.getTime() / 1000) | 0;
    let memberAddresses: tEthereumAddress[] = [];
    let memberShares: number[] = [];

    const members = Object.entries(params.Members);
    if (members) {
      [memberAddresses, memberShares] = transpose(members);
    }

    await mustWaitTx(
      configurator.configureTeamRewardPool(trp.address, poolName, unlockTimestamp, memberAddresses, memberShares)
    );

    const allocation = await trp.getAllocatedShares();
    console.log(
      `Deployed ${poolName}: ${trp.address}, allocation ${allocation / 100.0}%, ${
        members.length
      } members(s), unlocks at ${params.UnlockAt} (${unlockTimestamp})`
    );
  }

  const poolAddrs: tEthereumAddress[] = [];
  const poolNames: string[] = [];
  const poolFactors: number[] = [];

  if (!knownNamedPools.has(refPoolName)) {
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

  if (!knownNamedPools.has(treasuryPoolName)) {
    const poolName = treasuryPoolName;
    const params = rewardParams.TreasuryPool;

    const baselinePct = params.BasePoints;
    totalShare += baselinePct;

    const treasury = await addressProvider.getAddress(AccessFlags.TREASURY);

    const impl = await deployTreasuryRewardPool([rewardCtlAddress, 0, baselinePct, treasury], verify);
    console.log(`Deployed ${poolName}: `, impl.address);

    poolAddrs.push(impl.address);
    poolNames.push(poolName);
    poolFactors.push(params.BoostFactor);
  }

  if (rewardParams.BurnersPool.TotalWad > 0 && !knownNamedPools.has(burnPoolName)) {
    const poolName = burnPoolName;
    const params = rewardParams.BurnersPool;

    const unlockTimestamp = (params.MeltDownAt.getTime() / 1000) | 0;

    const brp = await deployNamedPermitFreezerRewardPool(
      poolName,
      [rewardCtlAddress, oneWad.multipliedBy(params.TotalWad).toFixed(), unlockTimestamp],
      verify
    );

    if (params.Providers.length > 0) {
      console.log(`Add providers to ${poolName}: ${params.Providers.length}`);
      (await Promise.all(params.Providers.map((value) => brp.addRewardProvider(value, ZERO_ADDRESS)))).forEach(
        async (value) => await value.wait(1)
      );
    }

    poolAddrs.push(brp.address);
    poolNames.push(poolName);
    poolFactors.push(params.BoostFactor);

    console.log(
      `Deployed ${poolName}: ${brp.address}, limit ${params.TotalWad} wad, melts at ${params.MeltDownAt} (${unlockTimestamp})`
    );
  }

  if (poolAddrs.length > 0) {
    await mustWaitTx(configurator.addNamedRewardPools(poolAddrs, poolNames, poolFactors));

    console.log(`Deployed ${poolNames.join(', ')}: ${poolAddrs}`);
    extraNames.push(...poolNames);
  }

  return [extraNames, totalShare];
};
