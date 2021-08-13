// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../../interfaces/IReserveDelegatedStrategy.sol';

abstract contract DefaultReserveDelegatedStrategy is IReserveDelegatedStrategy {
  address public immutable externalProvider;

  constructor(address externalProvider_) {
    externalProvider = externalProvider_;
  }

  function isDelegatedReserve() external pure override returns (bool) {
    return true;
  }
}
