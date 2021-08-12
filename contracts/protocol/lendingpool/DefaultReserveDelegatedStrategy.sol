// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../../interfaces/IReserveDelegatedStrategy.sol';

abstract contract DefaultReserveDelegatedStrategy is IReserveDelegatedStrategy {
  address public immutable externalProvider;

  constructor(address externalProvider_) {
    externalProvider = externalProvider_;
  }

  function baseVariableBorrowRate() external pure override returns (uint256) {
    return 0;
  }

  function getMaxVariableBorrowRate() external pure override returns (uint256) {
    return 0;
  }
}
