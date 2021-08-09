// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

interface IDerivedToken {
  /**
   * @dev Returns the address of the underlying asset of this token (E.g. WETH for agWETH)
   **/
  function UNDERLYING_ASSET_ADDRESS() external view returns (address);
}
