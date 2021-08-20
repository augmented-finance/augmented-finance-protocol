// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

interface ISweeper {
  /// @dev transfer ERC20 from the utility contract, for ERC20 recovery of direct transfers to the contract address.
  function sweepToken(
    address token,
    address to,
    uint256 amount
  ) external;
}
