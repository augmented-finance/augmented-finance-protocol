// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.12;

import {IERC20} from '../../dependencies/openzeppelin/contracts/IERC20.sol';

interface IWithdrawablePool {
  function withdraw(
    address asset,
    uint256 amount,
    address to
  ) external returns (uint256);

  function getReserveNormalizedIncome(address asset) external view returns (uint256);
}

interface IRedeemableToken is IERC20 {
  function UNDERLYING_ASSET_ADDRESS() external view returns (address);

  function POOL() external view returns (IWithdrawablePool);

  /**
   * @dev Returns the scaled balance of the user. The scaled balance is the sum of all the
   * updated stored balance divided by the reserve's liquidity index at the moment of the update
   * @param user The user whose balance is calculated
   * @return The scaled balance of the user
   **/
  function scaledBalanceOf(address user) external view returns (uint256);
}
