import { eContractid, IInterestRateStrategyParams, IReserveParams } from '../../helpers/types';

import {
  rateStrategyStableTwo,
  rateStrategyStableThree,
  rateStrategyWETH,
  rateStrategyAAVE,
  rateStrategyVolatileOne,
  rateStrategyVolatileTwo,
  externalReserveAAVE,
  externalReserveCOMP,
  externalReserveCETH,
} from './rateStrategies';

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

const externalAsset = (template: IReserveParams, strategy: IInterestRateStrategyParams, ltvDelta: number, decimals?: number) => {
  const result: IReserveParams = {
    strategy: strategy,
    baseLTVAsCollateral: template.baseLTVAsCollateral - ltvDelta,
    liquidationThreshold: template.liquidationThreshold,
    liquidationBonus: template.liquidationBonus + ((ltvDelta / 2)|0),
    borrowingEnabled: false,
    stableBorrowRateEnabled: false,
    reserveDecimals: decimals || template.reserveDecimals,
    depositTokenImpl: eContractid.DepositTokenImpl,
    reserveFactor: 0
  };
  return result;
}

export const strategyADAI = externalAsset(strategyDAI, externalReserveAAVE, 2000);
export const strategyAUSDC = externalAsset(strategyUSDC, externalReserveAAVE, 2000);
export const strategyAUSDT = externalAsset(strategyUSDT, externalReserveAAVE, 2000);
export const strategyAWBTC = externalAsset(strategyWBTC, externalReserveAAVE, 2000);
export const strategyAWETH = externalAsset(strategyWETH, externalReserveAAVE, 2000);

export const strategyCDAI = externalAsset(strategyDAI, externalReserveCOMP, 2000, 8);
export const strategyCUSDC = externalAsset(strategyUSDC, externalReserveCOMP, 2000, 8);
export const strategyCUSDT = externalAsset(strategyUSDT, externalReserveCOMP, 2000, 8);
export const strategyCWBTC = externalAsset(strategyWBTC, externalReserveCOMP, 2000, 8);
export const strategyCETH = externalAsset(strategyWETH, externalReserveCETH, 2000, 8);
