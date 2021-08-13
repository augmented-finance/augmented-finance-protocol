// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../../../dependencies/openzeppelin/contracts/Address.sol';
import '../../../interfaces/IUnderlyingStrategy.sol';

library UnderlyingHelper {
  function delegateWithdrawUnderlying(
    IUnderlyingStrategy strategy,
    address asset,
    uint256 amount,
    address to
  ) internal returns (uint256) {
    bytes memory result = Address.functionDelegateCall(
      address(strategy),
      abi.encodeWithSelector(IUnderlyingStrategy.delegatedWithdrawUnderlying.selector, asset, amount, to)
    );
    return abi.decode(result, (uint256));
  }
}
