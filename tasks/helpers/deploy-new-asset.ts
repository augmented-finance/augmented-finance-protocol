import { task } from 'hardhat/config';
import { eEthereumNetwork } from '../../helpers/types';
import * as marketConfigs from '../../markets/augmented';
import * as reserveConfigs from '../../markets/augmented/reservesConfigs';
import { chooseDepositTokenDeployment } from '../../helpers/init-helpers';
import { getMarketAddressController } from './../../helpers/contracts-getters';
import {
  deployMockReserveInterestRateStrategy,
  deployStableDebtToken,
  deployVariableDebtToken,
} from './../../helpers/contracts-deployments';
import { setDRE } from '../../helpers/misc-utils';
import { AccessFlags } from '../../helpers/access-flags';

const LENDING_POOL_ADDRESS_PROVIDER = {
  main: '0xb53c1a33016b2dc2ff3653530bff1848a515c8c5',
  kovan: '0x652B2937Efd0B5beA1c8d54293FC1289672AFC6b',
};

const cfg = marketConfigs.AugmentedConfig;

const isSymbolValid = (symbol: string, network: eEthereumNetwork) =>
  Object.keys(reserveConfigs).includes('strategy' + symbol) &&
  cfg.ReserveAssets[network][symbol] &&
  cfg.ReservesConfig[symbol] === reserveConfigs['strategy' + symbol];

task('external:deploy-new-asset', 'Deploy new reserve(s)')
  .addFlag('verify', 'Verify contracts at Etherscan')
  .addOptionalVariadicPositionalParam('symbols', `Asset symbol(s)`)
  .setAction(async ({ verify, symbols }, localBRE) => {
    const network = localBRE.network.name;
    throw 'not implemented';
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
    //     const reserveAssetAddress = cfg.ReserveAssets[localBRE.network.name][symbol];
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
