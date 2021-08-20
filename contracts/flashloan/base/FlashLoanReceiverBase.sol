// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../interfaces/IFlashLoanReceiver.sol';
import '../../interfaces/IFlashLoanAddressProvider.sol';
import '../../interfaces/ILendingPool.sol';

// solhint-disable var-name-mixedcase, func-name-mixedcase
abstract contract FlashLoanReceiverBase is IFlashLoanReceiver {
  IFlashLoanAddressProvider public immutable override ADDRESS_PROVIDER;
  ILendingPool public immutable override LENDING_POOL;

  constructor(IFlashLoanAddressProvider provider) {
    ADDRESS_PROVIDER = provider;
    LENDING_POOL = ILendingPool(provider.getLendingPool());
  }

  /// @dev backward compatibility
  function ADDRESSES_PROVIDER() external view returns (IFlashLoanAddressProvider) {
    return ADDRESS_PROVIDER;
  }
}
