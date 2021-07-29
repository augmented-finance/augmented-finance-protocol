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
import { chunk, falsyOrZeroAddress, getFirstSigner, waitForTx } from '../../helpers/misc-utils';
import { AccessFlags } from '../../helpers/access-flags';
import { BigNumber } from 'ethers';
import { oneRay, oneWad, RAY, WAD, WAD_RAY_RATIO_NUM, ZERO_ADDRESS } from '../../helpers/constants';
import { transpose } from 'underscore';
import { getDeployAccessController } from '../../helpers/deploy-helpers';
import { MarketAccessController, RewardConfigurator } from '../../types';

interface poolInitParams {
  provider: tEthereumAddress;
  impl: tEthereumAddress;
  poolName: string;
  baselinePercentage: BigNumber;
  initialRate: BigNumber;
  boostFactor: BigNumber;
  rateScale: BigNumber;
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
      await addressProvider.getStakeConfigurator()
    );

    await waitForTx(
      await addressProvider.grantRoles(
        (await getFirstSigner()).address,
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
      rateScale: BigNumber,
      name: string,
      poolName: string
    ) => {
      initParams.push({
        provider: provider,
        baselinePercentage: BigNumber.from(share.BasePoints),
        poolName: poolName,
        rateScale: rateScale,
        initialRate: BigNumber.from(0),
        boostFactor: BigNumber.from(share!.BoostFactor),
        impl: impl,
      });
      initNames.push(name);
    };

    let symbol: string;

    const buildToken = async (
      share: IRewardPoolParams | undefined,
      token: tEthereumAddress,
      rateScale: BigNumber,
      prefix: string
    ) => {
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
      buildPool(share!, token, poolImpl.address, rateScale, tokenSymbol, '');
    };

    const rewardParams = RewardParams; // getParamPerNetwork(RewardParams, network);

    const rewardController = await getRewardBooster(await addressProvider.getRewardController());
    const configurator = await getRewardConfiguratorProxy(
      await addressProvider.getRewardConfigurator()
    );

    const [extraNames, extraShare] = await deployExtraPools(
      addressProvider,
      freshStart,
      continuation,
      rewardParams,
      configurator,
      rewardController.address,
      verify
    );
    let totalShare = extraShare;

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

      const rateScale = BigNumber.from(
        oneRay.multipliedBy(tp.Scale == undefined ? 1 : tp.Scale).toFixed()
      );

      const rd = await lendingPool.getReserveData(asset);
      if (falsyOrZeroAddress(rd.aTokenAddress)) {
        console.log('Reserve is missing for asset (underlying):', symbol);
        continue;
      }

      await buildToken(tp.Share.deposit, rd.aTokenAddress, rateScale, Names.DepositSymbolPrefix);
      await buildToken(
        tp.Share.vDebt,
        rd.variableDebtTokenAddress,
        rateScale,
        Names.VariableDebtSymbolPrefix
      );
      await buildToken(
        tp.Share.sDebt,
        rd.stableDebtTokenAddress,
        rateScale,
        Names.StableDebtSymbolPrefix
      );

      if (tp.Share.stake != undefined) {
        await buildToken(
          tp.Share.stake,
          await stakeConfigurator.stakeTokenOf(rd.aTokenAddress),
          rateScale,
          Names.StakeSymbolPrefix
        );
      }
    }

    let newPoolsOffset = 0;
    const newNames: string[] = [];
    if (!freshStart || continuation) {
      const totals = await configurator.getPoolTotals(true);
      totalShare = totals.totalBaselinePercentage.toNumber();
      newPoolsOffset = totals.listCount.toNumber();
    }
    if (freshStart && newPoolsOffset <= 1) {
      newPoolsOffset = 0;
      newNames.push(Names.RewardStakeTokenSymbol);
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
      const tx3 = await waitForTx(
        await configurator.batchInitRewardPools(param, {
          gasLimit: 5000000,
        })
      );

      console.log(`  - Pool(s) ready for: ${chunkedNames[chunkIndex].join(', ')}`);
      console.log('    * gasUsed', tx3.gasUsed.toString());
    }

    newNames.push(...extraNames);
    newNames.push(...initNames);

    const initialRate = BigNumber.from(oneRay.multipliedBy(rewardParams.InitialRate).toFixed());
    await waitForTx(await rewardController.updateBaseline(initialRate));

    console.log(`Reward pools initialized with total rate: ${rewardParams.InitialRate}`);
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
        console.log(`    ${newNames[index]}: ${poolRate.div(WAD).toNumber() / WAD_RAY_RATIO_NUM}`);
        index++;
      }
      console.log(`Assigned reward rate:   ${totalRate.div(WAD).toNumber() / WAD_RAY_RATIO_NUM}`);
      console.log(`Initial reward rate: ${initialRate.div(WAD).toNumber() / WAD_RAY_RATIO_NUM}`);
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
  const teamPoolName = 'TeamPool';
  const refPoolName = 'RefPool';
  const burnPoolName = 'BurnPool';
  const treasuryPoolName = 'TreasuryPool';

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
  }

  if (!knownNamedPools.has(teamPoolName)) {
    const poolName = teamPoolName;
    extraNames.push(poolName);
    totalShare += rewardParams.TeamPool.BasePoints;
    const trp = await deployTeamRewardPool(
      [rewardCtlAddress, 0, rewardParams.TeamPool.BasePoints, rewardParams.TeamPool.Manager],
      verify
    );

    const unlockTimestamp = (rewardParams.TeamPool.UnlockAt.getTime() / 1000) | 0;
    let memberAddresses: tEthereumAddress[] = [];
    let memberShares: number[] = [];

    const members = Object.entries(rewardParams.TeamPool.Members);
    if (members) {
      [memberAddresses, memberShares] = transpose(members);
    }

    await configurator.configureTeamRewardPool(
      trp.address,
      poolName,
      unlockTimestamp,
      memberAddresses,
      memberShares
    );

    const allocation = await trp.getAllocatedShares();
    console.log(
      `Deployed ${poolName}: ${trp.address}, allocation ${allocation / 100.0}%, ${
        members.length
      } members(s), unlocks at ${rewardParams.TeamPool.UnlockAt} (${unlockTimestamp})`
    );
  }

  const poolAddrs: tEthereumAddress[] = [];
  const poolNames: string[] = [];
  const poolFactors: number[] = [];

  if (!knownNamedPools.has(refPoolName)) {
    const poolName = refPoolName;
    const params = rewardParams.ReferralPool;

    const impl = await deployReferralRewardPoolV1Impl(verify, continuation);
    console.log(`Deployed ${poolName} implementation: `, impl.address);

    const baselinePct = params.BasePoints;
    totalShare += baselinePct;

    const initData = await configurator.buildRewardPoolInitData(poolName, 0, RAY, baselinePct);
    await addressProvider.setAddressAsProxyWithInit(
      AccessFlags.REFERRAL_REGISTRY,
      impl.address,
      initData
    );
    const poolAddr = await addressProvider.getAddress(AccessFlags.REFERRAL_REGISTRY);

    poolAddrs.push(poolAddr);
    poolNames.push(poolName);
    poolFactors.push(params.BoostFactor);
  }

  if (!knownNamedPools.has(treasuryPoolName)) {
    const poolName = treasuryPoolName;
    const params = rewardParams.TreasuryPool;

    const baselinePct = params.BasePoints;
    totalShare += baselinePct;

    const treasury = await addressProvider.getTreasury();

    const impl = await deployTreasuryRewardPool(
      [rewardCtlAddress, 0, RAY, baselinePct, treasury],
      verify
    );
    console.log(`Deployed ${poolName}: `, impl.address);

    poolAddrs.push(impl.address);
    poolNames.push(poolName);
    poolFactors.push(params.BoostFactor);
  }

  if (
    rewardParams.PermitPool != undefined &&
    rewardParams.PermitPool!.TotalWad > 0 &&
    !knownNamedPools.has(burnPoolName)
  ) {
    const poolName = burnPoolName;
    const params = rewardParams.PermitPool!;

    const brp = await deployNamedPermitFreezerRewardPool(
      poolName,
      [rewardCtlAddress, oneWad.multipliedBy(params.TotalWad).toFixed()],
      verify
    );

    poolAddrs.push(brp.address);
    poolNames.push(poolName);
    poolFactors.push(params.BoostFactor);
  }

  if (poolAddrs.length > 0) {
    await waitForTx(await configurator.addNamedRewardPools(poolAddrs, poolNames, poolFactors));

    console.log(`Deployed ${poolNames.join(', ')}: ${poolAddrs}`);
    extraNames.push(...poolNames);
  }

  return [extraNames, totalShare];
};
