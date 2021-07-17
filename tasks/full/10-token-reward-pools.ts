import { task } from 'hardhat/config';
import { getParamPerNetwork } from '../../helpers/contracts-helpers';
import { loadPoolConfig, ConfigNames } from '../../helpers/configuration';
import {
  deployTokenWeightedRewardPoolImpl,
  deployTeamRewardPool,
  deployNamedPermitFreezerRewardPool,
  deployNamedReferralRewardPool,
} from '../../helpers/contracts-deployments';
import {
  tEthereumAddress,
  eNetwork,
  ICommonConfiguration,
  ITokenRewardPoolParams,
  IRewardPoolParams,
} from '../../helpers/types';
import {
  getLendingPoolProxy,
  getMarketAddressController,
  getRewardConfiguratorProxy,
  getStakeConfiguratorImpl,
  getRewardBooster,
  getIManagedRewardPool,
} from '../../helpers/contracts-getters';
import { chunk, falsyOrZeroAddress, getFirstSigner, waitForTx } from '../../helpers/misc-utils';
import { AccessFlags } from '../../helpers/access-flags';
import { BigNumber, BigNumberish } from 'ethers';
import { RAY, WAD, WAD_NUM, WAD_RAY_RATIO, WAD_RAY_RATIO_NUM } from '../../helpers/constants';

interface poolInitParams {
  provider: tEthereumAddress;
  impl: tEthereumAddress;
  baselinePercentage: BigNumber;
  initialRate: BigNumber;
  rateScale: BigNumber;
}

task(`full:init-reward-pools`, `Deploys reward pools`)
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addFlag('verify', `Verify contracts via Etherscan API.`)
  .setAction(async ({ verify, pool }, localBRE) => {
    await localBRE.run('set-DRE');
    const network = <eNetwork>localBRE.network.name;
    const poolConfig = loadPoolConfig(pool);
    const addressesProvider = await getMarketAddressController();

    const { ReserveAssets, RewardParams, Names } = poolConfig as ICommonConfiguration;

    const reserveAssets = getParamPerNetwork(ReserveAssets, network);
    const stakeConfigurator = await getStakeConfiguratorImpl(
      await addressesProvider.getStakeConfigurator()
    );

    await waitForTx(
      await addressesProvider.grantRoles(
        (await getFirstSigner()).address,
        AccessFlags.REWARD_CONFIG_ADMIN | AccessFlags.REWARD_RATE_ADMIN
      )
    );

    const poolImpl = await deployTokenWeightedRewardPoolImpl(verify);

    const lendingPool = await getLendingPoolProxy(await addressesProvider.getLendingPool());

    let initParams: poolInitParams[] = [];
    let initSymbols: string[] = [];
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
      initParams.push({
        provider: token,
        baselinePercentage: BigNumber.from(share!.BasePoints),
        rateScale: rateScale,
        initialRate: BigNumber.from(0),
        impl: poolImpl.address,
      });
      initSymbols.push(prefix + Names.SymbolPrefix + symbol);
    };

    const rewardParams = RewardParams; // getParamPerNetwork(RewardParams, network);

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

      let rateScale = BigNumber.from(RAY);
      if (tp.Scale != undefined) {
        rateScale = rateScale.mul(tp.Scale);
      }

      if (
        tp.Share.deposit != undefined ||
        tp.Share.vDebt != undefined ||
        tp.Share.sDebt != undefined
      ) {
        const rd = await lendingPool.getReserveData(asset);
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
      }
      await buildToken(
        tp.Share.stake,
        await stakeConfigurator.stakeTokenOf(asset),
        rateScale,
        Names.StakeSymbolPrefix
      );
    }

    const rewardController = await getRewardBooster(await addressesProvider.getRewardController());

    let totalShare = 0;
    let extraNames: string[] = [Names.RewardStakeTokenSymbol];
    {
      const poolName = 'TeamPool';
      extraNames.push(poolName);
      totalShare += rewardParams.TeamPool.Share;
      const trp = await deployTeamRewardPool(
        [rewardController.address, 0, rewardParams.TeamPool.Share, rewardParams.TeamPool.Manager],
        verify
      );
      await rewardController.addRewardPool(trp.address);
      console.log(`Deployed ${poolName}: `, trp.address);
    }

    if (rewardParams.ReferralPool != undefined && rewardParams.ReferralPool!.TotalWad > 0) {
      const poolName = 'RefPool';
      extraNames.push(poolName);
      const limit = BigNumber.from(WAD).mul(rewardParams.ReferralPool!.TotalWad);
      const brp = await deployNamedReferralRewardPool(
        poolName,
        [rewardController.address, limit, limit],
        verify
      );
      await rewardController.addRewardPool(brp.address);
      console.log(`Deployed ${poolName}: `, brp.address);
    }

    if (rewardParams.PermitPool != undefined && rewardParams.PermitPool!.TotalWad > 0) {
      const poolName = 'BurnPool';
      extraNames.push(poolName);
      const limit = BigNumber.from(WAD).mul(rewardParams.PermitPool!.TotalWad);
      const brp = await deployNamedPermitFreezerRewardPool(
        poolName,
        [rewardController.address, limit],
        verify
      );
      await rewardController.addRewardPool(brp.address);
      console.log(`Deployed ${poolName}: `, brp.address);
    }

    for (const params of initParams) {
      totalShare += params.baselinePercentage.toNumber();
    }

    console.log(`Total reward share: ${(0.0 + totalShare) / 100.0}%`);
    if (totalShare > 10000) {
      throw `excessive total reward share`;
    }

    // CHUNK CONFIGURATION
    const initChunks = 1;

    const chunkedParams = chunk(initParams, initChunks);
    const chunkedSymbols = chunk(initSymbols, initChunks);

    const configurator = await getRewardConfiguratorProxy(
      await addressesProvider.getRewardConfigurator()
    );

    console.log(`- Reward pools initialization with ${chunkedParams.length} txs`);
    for (let chunkIndex = 0; chunkIndex < chunkedParams.length; chunkIndex++) {
      const param = chunkedParams[chunkIndex];
      console.log(param);
      const tx3 = await waitForTx(
        await configurator.batchInitRewardPools(param, {
          gasLimit: 5000000,
        })
      );

      console.log(`  - Pool(s) ready for: ${chunkedSymbols[chunkIndex].join(', ')}`);
      console.log('    * gasUsed', tx3.gasUsed.toString());
    }

    extraNames.push(...initSymbols);
    initSymbols = extraNames;

    const initialRate = BigNumber.from(WAD).mul(rewardParams.InitialRate * WAD_RAY_RATIO_NUM);
    await rewardController.updateBaseline(initialRate);

    console.log(`  - Pool(s) initialized with rate: ${rewardParams.InitialRate}`);
    const poolList = await configurator.list();

    if (initSymbols.length != poolList.length) {
      console.log(
        `Different number of pools. Expected ${initSymbols.length}, actual ${poolList.length}`
      );
      console.log('Actual Pools: ', poolList);
    } else {
      let totalRate = BigNumber.from(0);

      console.log(`Rates of ${initSymbols.length} pools configured:`);
      let index = 0;
      for (const poolAddr of poolList) {
        const pool = await getIManagedRewardPool(poolAddr);
        const poolRate = await pool.getRate();

        totalRate = totalRate.add(poolRate);
        console.log(
          `    ${initSymbols[index]}: ${poolRate.div(WAD).toNumber() / WAD_RAY_RATIO_NUM}`
        );
        index++;
      }
      console.log(`Total rate:   ${totalRate.div(WAD).toNumber() / WAD_RAY_RATIO_NUM}`);
      console.log(`Initial rate: ${initialRate.div(WAD).toNumber() / WAD_RAY_RATIO_NUM}`);
    }
  });
