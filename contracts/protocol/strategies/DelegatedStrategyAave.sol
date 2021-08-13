// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import './DelegatedStrategyBase.sol';
import '../../dependencies/aave-protocol-v2/contracts/IAaveLendingPool.sol';
import '../../interfaces/IPoolToken.sol';
import '../../interfaces/IDerivedToken.sol';

contract DelegatedStrategyAave is DelegatedStrategyBase {
  function getDelegatedState(address asset) external view override returns (DelegatedState memory result) {
    address underlying = IDerivedToken(asset).UNDERLYING_ASSET_ADDRESS();
    AaveDataTypes.ReserveData memory state = IAaveLendingPool(IPoolToken(asset).POOL()).getReserveData(underlying);

    return
      DelegatedState({
        liquidityIndex: state.liquidityIndex,
        variableBorrowIndex: state.variableBorrowIndex,
        liquidityRate: state.currentLiquidityRate,
        variableBorrowRate: state.currentVariableBorrowRate,
        stableBorrowRate: state.currentStableBorrowRate,
        lastUpdateTimestamp: state.lastUpdateTimestamp
      });
  }

  function getDelegatedDepositIndex(address asset) external view override returns (uint256) {
    address underlying = IDerivedToken(asset).UNDERLYING_ASSET_ADDRESS();
    return IAaveLendingPool(IPoolToken(asset).POOL()).getReserveNormalizedIncome(underlying);
  }

  function getUnderlying(address asset) external view override returns (address) {
    return IDerivedToken(asset).UNDERLYING_ASSET_ADDRESS();
  }

  function internalWithdrawUnderlying(
    address asset,
    uint256 amount,
    address to
  ) internal override returns (uint256) {
    address underlying = IDerivedToken(asset).UNDERLYING_ASSET_ADDRESS();
    return IAaveLendingPool(IPoolToken(asset).POOL()).withdraw(underlying, amount, to);
  }
}