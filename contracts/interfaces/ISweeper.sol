// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

interface ISweeper {
  /// @dev transfer ERC20 from the utility contract, for ERC20 recovery of direct transfers to the contract address.
  function sweepToken(
    address token,
    address to,
    uint256 amount
  ) external;

  /// @dev transfer native Ether from the utility contract, for native Ether recovery in case of stuck Ether
  function sweepEth(address to, uint256 amount) external;
}
