import { oneRay } from '../../helpers/constants';
import { eContractid, IInterestRateStrategyParams, IReserveParams } from '../../helpers/types';

import {
  externalReserveAAVE,
  externalReserveCOMP,
  externalReserveCETH,
  externalAsset,
} from './rateStrategies';

const ray = (n: number) => oneRay.multipliedBy(n).toFixed();

const strategies = {
  // DAI
  stable2: <IInterestRateStrategyParams>{
    name: 'rateStrategyStableTwo',
    optimalUtilizationRate: ray(0.8),
    baseVariableBorrowRate: ray(0),
    variableRateSlope1: ray(0.04),
    variableRateSlope2: ray(0.75),
    stableRateSlope1: ray(0.02),
    stableRateSlope2: ray(0.75),
  },  
  // USDC USDT
  stable3: <IInterestRateStrategyParams>{
    name: 'rateStrategyStableThree',
    optimalUtilizationRate: ray(0.9),
    baseVariableBorrowRate: ray(0),
    variableRateSlope1: ray(0.04),
    variableRateSlope2: ray(0.60),
    stableRateSlope1: ray(0.02),
    stableRateSlope2: ray(0.60),
  },
  // WBTC
  volatile2: <IInterestRateStrategyParams>{
    name: 'rateStrategyVolatileTwo',
    optimalUtilizationRate: ray(0.65),
    baseVariableBorrowRate: ray(0),
    variableRateSlope1: ray(0.08),
    variableRateSlope2: ray(3),
    stableRateSlope1: ray(0.1),
    stableRateSlope2: ray(3),
  },
  // WETH
  WETH: <IInterestRateStrategyParams>{
    name: 'rateStrategyWETH',
    optimalUtilizationRate: ray(0.65),
    baseVariableBorrowRate: ray(0),
    variableRateSlope1: ray(0.08),
    variableRateSlope2: ray(1),
    stableRateSlope1: ray(0.1),
    stableRateSlope2: ray(1),
  },  
}

const stableBorrowRateEnabled = false;

const base = {
  DAI: <IReserveParams>{
    strategy: strategies.stable2,
    baseLTVAsCollateral: 8000,
    liquidationThreshold: 8500,
    liquidationBonus: 10500,
    borrowingEnabled: true,
    stableBorrowRateEnabled: stableBorrowRateEnabled,
    reserveDecimals: 18,
    depositTokenImpl: eContractid.DepositTokenImpl,
    reserveFactor: 500
  },

  USDC: <IReserveParams>{
    strategy: strategies.stable3,
    baseLTVAsCollateral: 8000,
    liquidationThreshold: 8500,
    liquidationBonus: 10500,
    borrowingEnabled: true,
    stableBorrowRateEnabled: stableBorrowRateEnabled,
    reserveDecimals: 6,
    depositTokenImpl: eContractid.DepositTokenImpl,
    reserveFactor: 500
  },

  USDT: <IReserveParams>{
    strategy: strategies.stable3,
    baseLTVAsCollateral: 8000,
    liquidationThreshold: 8500,
    liquidationBonus: 10500,
    borrowingEnabled: true,
    stableBorrowRateEnabled: stableBorrowRateEnabled,
    reserveDecimals: 6,
    depositTokenImpl: eContractid.DepositTokenImpl,
    reserveFactor: 500
  },

  WBTC: <IReserveParams>{
    strategy: strategies.volatile2,
    baseLTVAsCollateral: 8000,
    liquidationThreshold: 8500,
    liquidationBonus: 11000,
    borrowingEnabled: true,
    stableBorrowRateEnabled: stableBorrowRateEnabled,
    reserveDecimals: 8,
    depositTokenImpl: eContractid.DepositTokenImpl,
    reserveFactor: 500
  },

  WETH: <IReserveParams>{
    strategy: strategies.WETH,
    baseLTVAsCollateral: 8000,
    liquidationThreshold: 8500,
    liquidationBonus: 10500,
    borrowingEnabled: true,
    stableBorrowRateEnabled: stableBorrowRateEnabled,
    reserveDecimals: 18,
    depositTokenImpl: eContractid.DepositTokenImpl,
    reserveFactor: 500
  },
}

export const MainnetStrategies = {
  ...base,
  ADAI: externalAsset(base.DAI, externalReserveAAVE, 2000),
  AUSDC: externalAsset(base.USDC, externalReserveAAVE, 2000),
  AUSDT: externalAsset(base.USDT, externalReserveAAVE, 2000),
  AWBTC: externalAsset(base.WBTC, externalReserveAAVE, 2000),
  AWETH: externalAsset(base.WETH, externalReserveAAVE, 2000),
  
  CDAI: externalAsset(base.DAI, externalReserveCOMP, 2000, 8),
  CUSDC: externalAsset(base.USDC, externalReserveCOMP, 2000, 8),
  CUSDT: externalAsset(base.USDT, externalReserveCOMP, 2000, 8),
  CWBTC: externalAsset(base.WBTC, externalReserveCOMP, 2000, 8),
  CETH: externalAsset(base.WETH, externalReserveCETH, 2000, 8),
}
