// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

/// @dev Interface of the ERC20 standard as defined in the EIP.
interface ERC20Events {
  event Transfer(address indexed from, address indexed to, uint256 value);
  event Approval(address indexed owner, address indexed spender, uint256 value);
}
