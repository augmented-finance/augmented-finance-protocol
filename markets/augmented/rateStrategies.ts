import { eContractid, IInterestRateStrategyParams, IReserveParams } from '../../helpers/types';

export const externalReserveAAVE: IInterestRateStrategyParams = {
  name: 'externalReserveAAVE',
  strategyImpl: eContractid.DelegatedStrategyAave,
  optimalUtilizationRate: '',
  baseVariableBorrowRate: '',
  variableRateSlope1: '',
  variableRateSlope2: '',
  stableRateSlope1: '',
  stableRateSlope2: '',
}

export const externalReserveCOMP: IInterestRateStrategyParams = {
  name: 'externalReserveCOMP',
  strategyImpl: eContractid.DelegatedStrategyCompoundErc20,
  optimalUtilizationRate: '',
  baseVariableBorrowRate: '',
  variableRateSlope1: '',
  variableRateSlope2: '',
  stableRateSlope1: '',
  stableRateSlope2: '',
}

export const externalReserveCETH: IInterestRateStrategyParams = {
  name: 'externalReserveCETH',
  strategyImpl: eContractid.DelegatedStrategyCompoundEth,
  optimalUtilizationRate: '',
  baseVariableBorrowRate: '',
  variableRateSlope1: '',
  variableRateSlope2: '',
  stableRateSlope1: '',
  stableRateSlope2: '',
}


export const externalAsset = (template: IReserveParams, strategy: IInterestRateStrategyParams, ltvDelta: number, decimals?: number) => {
  const result: IReserveParams = {
    strategy: strategy,
    baseLTVAsCollateral: template.baseLTVAsCollateral - ltvDelta,
    liquidationThreshold: template.liquidationThreshold - ltvDelta,
    liquidationBonus: template.liquidationBonus + ((ltvDelta / 2)|0),
    borrowingEnabled: false,
    stableBorrowRateEnabled: false,
    reserveDecimals: decimals || template.reserveDecimals,
    depositTokenImpl: eContractid.DepositTokenImpl,
    reserveFactor: 0
  };
  return result;
}

export const assetReserve = (
  strategy: IInterestRateStrategyParams,
  baseLTVAsCollateral: number,
  liquidationThreshold: number,
  liquidationBonus: number,
  reserveDecimals: number,
  reserveFactor: number,
  borrowingEnabled: boolean = true,
  stableBorrowRateEnabled: boolean = false,
  depositTokenImpl: eContractid = eContractid.DepositTokenImpl,
): IReserveParams => {
  return <IReserveParams>{
    strategy,
    baseLTVAsCollateral,
    liquidationThreshold,
    liquidationBonus,
    reserveDecimals, 
    reserveFactor,
    borrowingEnabled,
    stableBorrowRateEnabled,
    depositTokenImpl,
  }
}
