// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

/// @dev ILendingPoolAaveCompatible uses uint16 referral for full backward compatibility with AAVE
interface ILendingPoolAaveCompatible {
  function deposit(
    address asset,
    uint256 amount,
    address onBehalfOf,
    uint16 referral
  ) external;

  function borrow(
    address asset,
    uint256 amount,
    uint256 interestRateMode,
    uint16 referral,
    address onBehalfOf
  ) external;

  function flashLoan(
    address receiverAddress,
    address[] calldata assets,
    uint256[] calldata amounts,
    uint256[] calldata modes,
    address onBehalfOf,
    bytes calldata params,
    uint16 referral
  ) external;
}
