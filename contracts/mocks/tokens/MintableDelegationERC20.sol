// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../../tools/tokens/ERC20Base.sol';

/**
 * @title ERC20Mintable
 * @dev ERC20 minting logic
 */
contract MintableDelegationERC20 is ERC20Base {
  address public delegatee;

  constructor(
    string memory name,
    string memory symbol,
    uint8 decimals
  ) ERC20Base(name, symbol, decimals) {}

  /**
   * @dev Function to mint tokensp
   * @param value The amount of tokens to mint.
   * @return A boolean that indicates if the operation was successful.
   */
  function mint(uint256 value) public returns (bool) {
    _mint(msg.sender, value);
    return true;
  }

  function delegate(address delegateeAddress) external {
    delegatee = delegateeAddress;
  }
}
