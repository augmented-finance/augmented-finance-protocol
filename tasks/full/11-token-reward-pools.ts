import { task } from 'hardhat/config';
import { exit } from 'process';
import { getParamPerNetwork } from '../../helpers/contracts-helpers';
import { loadPoolConfig, ConfigNames } from '../../helpers/configuration';
import { deployTokenWeightedRewardPoolImpl } from '../../helpers/contracts-deployments';
import { eNetwork, ICommonConfiguration, ITokenRewardPoolParams } from '../../helpers/types';
import {
  getLendingPoolProxy,
  getMarketAddressController,
  getRewardConfiguratorProxy,
  getStakeConfiguratorImpl,
} from '../../helpers/contracts-getters';
import { chunk, falsyOrZeroAddress, getFirstSigner, waitForTx } from '../../helpers/misc-utils';
import { AccessFlags } from '../../helpers/access-flags';
import { BigNumber, BigNumberish } from 'ethers';
import { RAY } from '../../helpers/constants';

task(`full:init-token-reward-pools`, `Deploys token reward pools`)
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

    const poolImpl = await deployTokenWeightedRewardPoolImpl(verify);

    const lendingPool = await getLendingPoolProxy(await addressesProvider.getLendingPool());

    let initParams: {
      provider: string;
      impl: string;
      baselinePercentage: BigNumberish;
      initialRate: BigNumberish;
      rateScale: BigNumberish;
    }[] = [];
    let initSymbols: string[] = [];

    let totalShare = 0;

    const rewardParams = RewardParams; // getParamPerNetwork(RewardParams, network);
    const initialRate = BigNumber.from(RAY).mul(rewardParams.InitialRate);

    for (const [symbol, opt] of Object.entries(rewardParams.TokenPools)) {
      if (opt == undefined) {
        continue;
      }
      const tokenParams: ITokenRewardPoolParams = opt;

      const asset = reserveAssets[symbol];
      if (falsyOrZeroAddress(asset)) {
        console.log('Reward asset (underlying) is missing:', symbol);
        continue;
      }

      const startIndex = initParams.length;

      let rateScale = BigNumber.from(RAY);
      if (tokenParams.Scale != undefined) {
        rateScale = rateScale.mul(tokenParams.Scale);
      }

      if (
        tokenParams.Share.deposit != undefined ||
        tokenParams.Share.vDebt != undefined ||
        tokenParams.Share.sDebt != undefined
      ) {
        const reserveData = await lendingPool.getReserveData(asset);
        if (tokenParams.Share.deposit != undefined) {
          const share = tokenParams.Share.deposit;
          const token = reserveData.aTokenAddress;
          if (!falsyOrZeroAddress(token)) {
            totalShare += share;
            initParams.push({
              provider: token,
              baselinePercentage: share,
              rateScale: rateScale,
              initialRate: initialRate.mul(share).div(10000),
              impl: poolImpl.address,
            });
            initSymbols.push(Names.DepositSymbolPrefix + symbol);
          }
        }
        if (tokenParams.Share.vDebt != undefined) {
          const share = tokenParams.Share.vDebt;
          const token = reserveData.variableDebtTokenAddress;
          if (!falsyOrZeroAddress(token)) {
            totalShare += share;
            initParams.push({
              provider: token,
              baselinePercentage: share,
              rateScale: rateScale,
              initialRate: initialRate.mul(share).div(10000),
              impl: poolImpl.address,
            });
            initSymbols.push(Names.VariableDebtSymbolPrefix + symbol);
          }
        }
        if (tokenParams.Share.sDebt != undefined) {
          const share = tokenParams.Share.sDebt;
          const token = reserveData.stableDebtTokenAddress;
          if (!falsyOrZeroAddress(token)) {
            totalShare += share;
            initParams.push({
              provider: token,
              baselinePercentage: share,
              rateScale: rateScale,
              initialRate: initialRate.mul(share).div(10000),
              impl: poolImpl.address,
            });
            initSymbols.push(Names.StableDebtSymbolPrefix + symbol);
          }
        }
      }

      if (tokenParams.Share.stake != undefined) {
        const share = tokenParams.Share.stake;
        const token = await stakeConfigurator.stakeTokenOf(asset);
        if (!falsyOrZeroAddress(token)) {
          totalShare += share;
          initParams.push({
            provider: token,
            baselinePercentage: share,
            rateScale: rateScale,
            initialRate: initialRate.mul(share).div(10000),
            impl: poolImpl.address,
          });
          initSymbols.push(Names.StableDebtSymbolPrefix + symbol);
        }
      }
    }

    console.log(`Total reward share: ${(0.0 + totalShare) / 100.0}%`);
    if (totalShare > 10000) {
      throw `excessive total reward share`;
    }

    // CHUNK CONFIGURATION
    const initChunks = 1;

    const chunkedParams = chunk(initParams, initChunks);
    const chunkedSymbols = chunk(initSymbols, initChunks);

    await waitForTx(
      await addressesProvider.grantRoles(
        (await getFirstSigner()).address,
        AccessFlags.REWARD_CONFIG_ADMIN
      )
    );

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
  });
