import { eContractid, IInterestRateStrategyParams, IReserveParams } from '../../helpers/types';

import {
  rateStrategyStableTwo,
  rateStrategyStableThree,
  rateStrategyWETH,
  rateStrategyAAVE,
  rateStrategyVolatileOne,
  rateStrategyVolatileTwo,
  externalReserveAAVE,
} from './rateStrategies';

export const strategyDAI: IReserveParams = {
  strategy: rateStrategyStableTwo,
  baseLTVAsCollateral: 7500,
  liquidationThreshold: 8000,
  liquidationBonus: 10500,
  borrowingEnabled: true,
  stableBorrowRateEnabled: true,
  reserveDecimals: 18,
  depositTokenImpl: eContractid.DepositTokenImpl,
  reserveFactor: 1000
};

export const strategyUSDC: IReserveParams = {
  strategy: rateStrategyStableThree,
  baseLTVAsCollateral: 8000,
  liquidationThreshold: 8500,
  liquidationBonus: 10500,
  borrowingEnabled: true,
  stableBorrowRateEnabled: true,
  reserveDecimals: 6,
  depositTokenImpl: eContractid.DepositTokenImpl,
  reserveFactor: 1000
};

export const strategyUSDT: IReserveParams = {
  strategy: rateStrategyStableThree,
  baseLTVAsCollateral: 8000,
  liquidationThreshold: 8500,
  liquidationBonus: 10500,
  borrowingEnabled: true,
  stableBorrowRateEnabled: true,
  reserveDecimals: 6,
  depositTokenImpl: eContractid.DepositTokenImpl,
  reserveFactor: 1000
};

export const strategyAAVE: IReserveParams = {
  strategy: rateStrategyAAVE,
  baseLTVAsCollateral: 5000,
  liquidationThreshold: 6500,
  liquidationBonus: 11000,
  borrowingEnabled: false,
  stableBorrowRateEnabled: false,
  reserveDecimals: 18,
  depositTokenImpl: eContractid.DepositTokenImpl,
  reserveFactor: 0
};

export const strategyWETH: IReserveParams = {
  strategy: rateStrategyWETH,
  baseLTVAsCollateral: 8000,
  liquidationThreshold: 8250,
  liquidationBonus: 10500,
  borrowingEnabled: true,
  stableBorrowRateEnabled: true,
  reserveDecimals: 18,
  depositTokenImpl: eContractid.DepositTokenImpl,
  reserveFactor: 1000
};

export const strategyLINK: IReserveParams = {
  strategy: rateStrategyVolatileOne,
  baseLTVAsCollateral: 7000,
  liquidationThreshold: 7500,
  liquidationBonus: 11000,
  borrowingEnabled: true,
  stableBorrowRateEnabled: true,
  reserveDecimals: 18,
  depositTokenImpl: eContractid.DepositTokenImpl,
  reserveFactor: 2000
};

export const strategyWBTC: IReserveParams = {
  strategy: rateStrategyVolatileTwo,
  baseLTVAsCollateral: 7000,
  liquidationThreshold: 7500,
  liquidationBonus: 11000,
  borrowingEnabled: true,
  stableBorrowRateEnabled: true,
  reserveDecimals: 8,
  depositTokenImpl: eContractid.DepositTokenImpl,
  reserveFactor: 2000
};

const externalAsset = (template: IReserveParams, strategy: IInterestRateStrategyParams, ltdDelta: number) => {
  const result: IReserveParams = {
    strategy: strategy,
    baseLTVAsCollateral: template.baseLTVAsCollateral - ltdDelta,
    liquidationThreshold: template.liquidationThreshold,
    liquidationBonus: template.liquidationBonus + ((ltdDelta / 2)|0),
    borrowingEnabled: false,
    stableBorrowRateEnabled: false,
    reserveDecimals: template.reserveDecimals,
    depositTokenImpl: eContractid.DepositTokenImpl,
    reserveFactor: 0
  };
  return result;
}

export const strategyADAI = externalAsset(strategyDAI, externalReserveAAVE, 2000);

