import { task, types } from 'hardhat/config';
import {
  eEthereumNetwork,
  ICommonConfiguration,
  IRewardPoolParams,
  ITokenRewardPoolParams,
  tEthereumAddress,
} from '../../helpers/types';
import * as marketConfigs from '../../markets/augmented';
import {
  chooseDepositTokenDeployment,
  configureReservesByHelper,
  initReservesByHelper,
} from '../../helpers/init-helpers';
import {
  getLendingPoolConfiguratorProxy,
  getLendingPoolProxy,
  getMarketAddressController,
  getProtocolDataProvider,
  getRewardConfiguratorProxy,
} from './../../helpers/contracts-getters';
import {
  deployDepositTokenImpl,
  deployMockReserveInterestRateStrategy,
  deployStableDebtToken,
  deployTokenWeightedRewardPoolImpl,
  deployTreasuryImpl,
  deployVariableDebtToken,
  deployVariableDebtTokenImpl,
} from './../../helpers/contracts-deployments';
import { autoGas, chunk, falsyOrZeroAddress, mustWaitTx, setDRE, waitForTx } from '../../helpers/misc-utils';
import { AccessFlags } from '../../helpers/access-flags';
import { ZERO_ADDRESS } from '../../helpers/constants';
import { ConfigNames, loadPoolConfig } from '../../helpers/configuration';
import { getParamPerNetwork } from '../../helpers/contracts-helpers';
import { getDeployAccessController, setAndGetAddressAsProxy } from '../../helpers/deploy-helpers';
import { AugmentedConfig } from '../../markets/augmented';
import { BigNumber, BigNumberish } from 'ethers';

const LENDING_POOL_ADDRESS_PROVIDER = {
  main: '0xb53c1a33016b2dc2ff3653530bff1848a515c8c5',
  kovan: '0x652B2937Efd0B5beA1c8d54293FC1289672AFC6b',
};

interface poolInitParams {
  provider: tEthereumAddress;
  impl: tEthereumAddress;
  poolName: string;
  baselinePercentage: BigNumber;
  initialRate: BigNumber;
  boostFactor: BigNumber;
}

task('external:deploy-new-asset', 'Deploy new reserve(s)')
  .addParam('ctl', 'Address of MarketAddressController', ZERO_ADDRESS, types.string)
  .addFlag('verify', 'Verify contracts at Etherscan')
  .addOptionalVariadicPositionalParam('symbols', `Asset symbol(s)`)
  .setAction(async ({ ctl, verify, symbols }, localBRE) => {
    setDRE(localBRE);
    // const addressProvider = await getMarketAddressController(ctl);
    // const configurator = await getLendingPoolConfiguratorProxy(
    //   await addressProvider.getAddress(AccessFlags.LENDING_POOL_CONFIGURATOR)
    // );

    const poolConfig = AugmentedConfig;
    const { Names, ReserveAssets, RewardParams, ReserveAssetsOpt, ReservesConfig } = poolConfig;

    const reserveAssets = getParamPerNetwork(ReserveAssets);
    if (!reserveAssets) {
      throw 'Reserve assets are undefined. Check configuration.';
    }
    const reserveAssetsOpt = getParamPerNetwork(ReserveAssetsOpt);
    const reservesConfig = getParamPerNetwork(ReservesConfig);

    const [freshStart, continuation, addressProvider] = await getDeployAccessController();

    const testHelpers = await getProtocolDataProvider(await addressProvider.getAddress(AccessFlags.DATA_HELPER));

    // await addressProvider.setAnyRoleMode(true);
    // await addressProvider.grantRoles('0xFf05f6E87F0BcB38b7aDF9F800a5c4Bd02D7cB63', AccessFlags.REWARD_CONFIG_ADMIN | AccessFlags.POOL_ADMIN);

    // Treasury implementation is updated for existing installations
    const treasuryAddress = await addressProvider.getAddress(AccessFlags.TREASURY);
    console.log('\tTreasury:', treasuryAddress);

    // console.log('ReserveAssets: ', reserveAssets);
    // console.log('reservesConfig: ', reservesConfig);

    // asset initialization is skipped for existing assets
    await initReservesByHelper(
      addressProvider,
      reservesConfig,
      reserveAssetsOpt,
      reserveAssets,
      Names,
      // existing reserves will be skipped for existing installations
      true,
      verify
    );
    // but configuration will be always applied
    console.log('BEFORE configureReservesByHelper');
    await configureReservesByHelper(addressProvider, reservesConfig, reserveAssets, testHelpers);

    // ======
    const lendingPool = await getLendingPoolProxy(await addressProvider.getLendingPool());
    const rewardParams = getParamPerNetwork(RewardParams.RewardPools);

    const knownReserves: {
      baseSymbol: string;
      tokens: tEthereumAddress[];
      shares: (IRewardPoolParams | undefined)[];
    }[] = [];

    for (const [sym, opt] of Object.entries(rewardParams.TokenPools)) {
      if (opt === undefined || sym.toLowerCase() !== 'ust') {
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
        // info.tokens.push(await stakeConfigurator.stakeTokenOf(rd.depositTokenAddress));
        // info.shares.push(tp.Share.stake);
      }
      knownReserves.push(info);
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
            console.log(knownReserve.baseSymbol, '<----- skip share');

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

    const configuratorAddr = await addressProvider.getAddress(AccessFlags.REWARD_CONFIGURATOR);
    const configurator = await getRewardConfiguratorProxy(configuratorAddr);

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

    // CHUNK CONFIGURATION
    const initChunks = 4;

    const chunkedParams = chunk(initParams, initChunks);
    const chunkedNames = chunk(initNames, initChunks);

    console.log(`- Reward pools initialization with ${chunkedParams.length} txs`);
    for (let chunkIndex = 0; chunkIndex < chunkedParams.length; chunkIndex++) {
      const param = chunkedParams[chunkIndex];
      console.log(param);
      const tx3 = await mustWaitTx(
        configurator.batchInitRewardPools(param, {
          gasLimit: 5000000,
        })
      );

      console.log(`  - Pool(s) ready for: ${chunkedNames[chunkIndex].join(', ')}`);
      console.log('    * gasUsed', tx3.gasUsed.toString());
    }

    // const activePools = await configurator.list();
    // console.log(activePools);

    // await configurator.batchInitRewardPools([param]);

    // throw 'not implemented';
    //     if (!isSymbolValid(symbol, network as eEthereumNetwork)) {
    //       throw new Error(
    //         `
    // WRONG RESERVE ASSET SETUP:
    //         The symbol ${symbol} has no reserve Config and/or reserve Asset setup.
    //         update /markets/aave/index.ts and add the asset address for ${network} network
    //         update /markets/aave/reservesConfigs.ts and add parameters for ${symbol}
    //         `
    //       );
    //     }
    //     setDRE(localBRE);
    //     const strategyParams = reserveConfigs['strategy' + symbol];
    //     const deployDepositToken = chooseDepositTokenDeployment(strategyParams.depositTokenImpl);
    //     const addressProvider = await getMarketAddressController(LENDING_POOL_ADDRESS_PROVIDER[network]);
    //     const poolAddress = await addressProvider.getLendingPool();
    //     const treasuryAddress = await addressProvider.getAddress(AccessFlags.TREASURY);

    //     const names = cfg.Names;
    //     const depositToken = await deployDepositToken(
    //       [
    //         poolAddress,
    //         reserveAssetAddress,
    //         treasuryAddress,
    //         `${names.DepositTokenNamePrefix} ${symbol}`,
    //         `${names.DepositSymbolPrefix}${symbol}`,
    //       ],
    //       verify
    //     );
    //     const stableDebt = await deployStableDebtToken(
    //       [
    //         poolAddress,
    //         reserveAssetAddress,
    //         treasuryAddress,
    //         `${names.StableDebtTokenNamePrefix} ${symbol}`,
    //         `${names.StableDebtSymbolPrefix}${symbol}`,
    //       ],
    //       verify
    //     );
    //     const variableDebt = await deployVariableDebtToken(
    //       [
    //         poolAddress,
    //         reserveAssetAddress,
    //         treasuryAddress,
    //         `${names.VariableDebtTokenNamePrefix} ${symbol}`,
    //         `${names.VariableDebtSymbolPrefix}${symbol}`,
    //       ],
    //       verify
    //     );
    //     const rates = await deployMockReserveInterestRateStrategy(
    //       [
    //         addressProvider.address,
    //         strategyParams.strategy.optimalUtilizationRate,
    //         strategyParams.strategy.baseVariableBorrowRate,
    //         strategyParams.strategy.variableRateSlope1,
    //         strategyParams.strategy.variableRateSlope2,
    //         strategyParams.strategy.stableRateSlope1,
    //         strategyParams.strategy.stableRateSlope2,
    //       ],
    //       verify
    //     );
    //     console.log(`
    //     New asset ${symbol} deployed on ${network}:
    //     Deposit address: ${depositToken.address}
    //     Variable Debt address: ${variableDebt.address}
    //     Stable Debt address: ${stableDebt.address}
    //     Strategy Implementation for ${symbol} address: ${rates.address}
    //     `);
  });
