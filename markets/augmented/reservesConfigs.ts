import { oneRay } from '../../helpers/constants';
import { eContractid, IInterestRateStrategyParams, IMarketRates, IReserveParams } from '../../helpers/types';

const ray = (n: number) => oneRay.multipliedBy(n).toFixed();
const stableRate = (base: number) : IMarketRates => ({ borrowRate: ray(base) });

export const TestStableBaseRates = {
  USDC: stableRate(0.039),
  USDT: stableRate(0.035),
  DAI: stableRate(0.039),
  WBTC: stableRate(0.03),
  WETH: stableRate(0.03),
}

const strategies = {
  AAVE: <IInterestRateStrategyParams> {
    name: 'rateStrategyAAVE',
    optimalUtilizationRate: ray(0.45),
    baseVariableBorrowRate: '0',
    variableRateSlope1: '0',
    variableRateSlope2: '0',
    stableRateSlope1: '0',
    stableRateSlope2: '0',
  },
  
  // BUSD SUSD
  stable1: <IInterestRateStrategyParams> {
    name: 'rateStrategyStableOne',
    optimalUtilizationRate: ray(0.8),
    baseVariableBorrowRate: ray(0),
    variableRateSlope1: ray(0.04),
    variableRateSlope2: ray(1),
    stableRateSlope1: '0',
    stableRateSlope2: '0',
  },
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

  // BAT ENJ LINK MANA MKR REN YFI ZRX
  volatile1: <IInterestRateStrategyParams>{
    name: 'rateStrategyVolatileOne',
    optimalUtilizationRate: ray(0.45),
    baseVariableBorrowRate: ray(0),
    variableRateSlope1: ray(0.07),
    variableRateSlope2: ray(3),
    stableRateSlope1: ray(0.1),
    stableRateSlope2: ray(3),
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

  // SNX
  volatile3: <IInterestRateStrategyParams>{
    name: 'rateStrategyVolatileThree',
    optimalUtilizationRate: ray(0.65),
    baseVariableBorrowRate: ray(0),
    variableRateSlope1: ray(0.08),
    variableRateSlope2: ray(3),
    stableRateSlope1: ray(0.1),
    stableRateSlope2: ray(3),
  },

  volatile4: <IInterestRateStrategyParams>{
    name: 'rateStrategyVolatileFour',
    optimalUtilizationRate: ray(0.45),
    baseVariableBorrowRate: '0',
    variableRateSlope1: ray(0.07),
    variableRateSlope2: ray(3),
    stableRateSlope1: '0',
    stableRateSlope2: '0',
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

const base = {
  AAVE: <IReserveParams> {
    strategy: strategies.AAVE,
    baseLTVAsCollateral: 5000,
    liquidationThreshold: 6500,
    liquidationBonus: 11000,
    borrowingEnabled: false,
    stableBorrowRateEnabled: false,
    reserveDecimals: 18,
    depositTokenImpl: eContractid.DepositTokenImpl,
    reserveFactor: 0
  },
  
  LINK: <IReserveParams> {
    strategy: strategies.volatile1,
    baseLTVAsCollateral: 7000,
    liquidationThreshold: 7500,
    liquidationBonus: 11000,
    borrowingEnabled: true,
    stableBorrowRateEnabled: true,
    reserveDecimals: 18,
    depositTokenImpl: eContractid.DepositTokenImpl,
    reserveFactor: 2000
  },
  
  DAI: <IReserveParams>{
    strategy: strategies.stable2,
    baseLTVAsCollateral: 7500,
    liquidationThreshold: 8000,
    liquidationBonus: 10500,
    borrowingEnabled: true,
    stableBorrowRateEnabled: true,
    reserveDecimals: 18,
    depositTokenImpl: eContractid.DepositTokenImpl,
    reserveFactor: 1000
    },

  USDC: <IReserveParams>{
    strategy: strategies.stable3,
    baseLTVAsCollateral: 8000,
    liquidationThreshold: 8500,
    liquidationBonus: 10500,
    borrowingEnabled: true,
    stableBorrowRateEnabled: true,
    reserveDecimals: 6,
    depositTokenImpl: eContractid.DepositTokenImpl,
    reserveFactor: 1000
  },

  USDT: <IReserveParams>{
    strategy: strategies.stable3,
    baseLTVAsCollateral: 8000,
    liquidationThreshold: 8500,
    liquidationBonus: 10500,
    borrowingEnabled: true,
    stableBorrowRateEnabled: true,
    reserveDecimals: 6,
    depositTokenImpl: eContractid.DepositTokenImpl,
    reserveFactor: 1000
  },

  WBTC: <IReserveParams>{
    strategy: strategies.volatile2,
    baseLTVAsCollateral: 7000,
    liquidationThreshold: 7500,
    liquidationBonus: 11000,
    borrowingEnabled: true,
    stableBorrowRateEnabled: true,
    reserveDecimals: 8,
    depositTokenImpl: eContractid.DepositTokenImpl,
    reserveFactor: 2000
  },

  WETH: <IReserveParams>{
    strategy: strategies.WETH,
    baseLTVAsCollateral: 8000,
    liquidationThreshold: 8250,
    liquidationBonus: 10500,
    borrowingEnabled: true,
    stableBorrowRateEnabled: true,
    reserveDecimals: 18,
    depositTokenImpl: eContractid.DepositTokenImpl,
    reserveFactor: 1000
  },
}

export const TestReserves = {
  ...base,
  // ADAI: externalAsset(base.DAI, externalReserveAAVE, 2000),
  // AUSDC: externalAsset(base.USDC, externalReserveAAVE, 2000),
  // AUSDT: externalAsset(base.USDT, externalReserveAAVE, 2000),
  // AWBTC: externalAsset(base.WBTC, externalReserveAAVE, 2000),
  // AWETH: externalAsset(base.WETH, externalReserveAAVE, 2000),
  
  // CDAI: externalAsset(base.DAI, externalReserveCOMP, 2000, 8),
  // CUSDC: externalAsset(base.USDC, externalReserveCOMP, 2000, 8),
  // CUSDT: externalAsset(base.USDT, externalReserveCOMP, 2000, 8),
  // CWBTC: externalAsset(base.WBTC, externalReserveCOMP, 2000, 8),
  // CETH: externalAsset(base.WETH, externalReserveCETH, 2000, 8),
}

export const TestStrategies = strategies;