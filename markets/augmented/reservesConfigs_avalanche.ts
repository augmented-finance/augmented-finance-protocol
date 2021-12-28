import { oneRay } from '../../helpers/constants';
import { IInterestRateStrategyParams, IMarketRates } from '../../helpers/types';
import { assetReserve } from './rateStrategies';

const ray = (n: number) => oneRay.multipliedBy(n).toFixed();
const stableRate = (base: number): IMarketRates => ({ borrowRate: ray(base) });

export const AvalancheStableBaseRates = {
  USDT: stableRate(0.03),
  WAVAX: stableRate(0.03),
  WETH: stableRate(0.03),
  USDC: stableRate(0.03),
  DAI: stableRate(0.03),
  MIM: stableRate(0.03),
  WBTC: stableRate(0.03),
  JOE: stableRate(0.03),
  QI: stableRate(0.03),
  SPELL: stableRate(0.03),
  LINK: stableRate(0.03),
  AAVE: stableRate(0.03),
};

const strategies = {
  S_80_0_8_200_10_200: <IInterestRateStrategyParams>{
    name: 'S_80_0_8_200_10_200',
    optimalUtilizationRate: ray(0.8),
    baseVariableBorrowRate: ray(0),
    variableRateSlope1: ray(0.08),
    variableRateSlope2: ray(2.0),
    stableRateSlope1: ray(0.1),
    stableRateSlope2: ray(2.0),
  },
  S_90_0_4_100_2_100: <IInterestRateStrategyParams>{
    name: 'S_90_0_4_100_2_100',
    optimalUtilizationRate: ray(0.9),
    baseVariableBorrowRate: ray(0),
    variableRateSlope1: ray(0.04),
    variableRateSlope2: ray(1.0),
    stableRateSlope1: ray(0.02),
    stableRateSlope2: ray(1.0),
  },
  S_70_0_15_300_15_300: <IInterestRateStrategyParams>{
    name: 'S_70_0_15_300_15_300',
    optimalUtilizationRate: ray(0.7),
    baseVariableBorrowRate: ray(0),
    variableRateSlope1: ray(0.15),
    variableRateSlope2: ray(3.0),
    stableRateSlope1: ray(0.15),
    stableRateSlope2: ray(3.0),
  },
};

export const AvalancheReserves = {
  WAVAX: assetReserve(strategies.S_80_0_8_200_10_200, 8000, 8500, 10500, 18, 500, true, false),
  WBTC: assetReserve(strategies.S_80_0_8_200_10_200, 8000, 8500, 10500, 8, 500, true, false),
  WETH: assetReserve(strategies.S_80_0_8_200_10_200, 8000, 8500, 10500, 18, 500, true, false),

  USDT: assetReserve(strategies.S_90_0_4_100_2_100, 8000, 8500, 10500, 6, 500, true, false),
  DAI: assetReserve(strategies.S_90_0_4_100_2_100, 8000, 8500, 10500, 18, 500, true, false),
  USDC: assetReserve(strategies.S_90_0_4_100_2_100, 8000, 8500, 10500, 6, 500, true, false),
  MIM: assetReserve(strategies.S_90_0_4_100_2_100, 8000, 8500, 11000, 18, 500, true, false),

  LINK: assetReserve(strategies.S_70_0_15_300_15_300, 6000, 6500, 11000, 18, 500, true, false),
  AAVE: assetReserve(strategies.S_70_0_15_300_15_300, 6000, 6500, 11000, 18, 500, true, false),

  JOE: assetReserve(strategies.S_70_0_15_300_15_300, 6000, 6500, 11000, 18, 500, true, false),
  QI: assetReserve(strategies.S_70_0_15_300_15_300, 6000, 6500, 11000, 18, 500, true, false),
  SPELL: assetReserve(strategies.S_70_0_15_300_15_300, 6000, 6500, 11000, 18, 500, true, false),
};
