// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

interface ICToken {
  /**
   * @notice Accrue interest then return the up-to-date exchange rate
   * @return Calculated exchange rate scaled by 1 * 10^(18 - 8 + Underlying Token Decimals)
   */
  function exchangeRateCurrent() external returns (uint256);

  /**
   * @notice Calculates the exchange rate from the underlying to the CToken
   * @dev This function does not accrue interest before calculating the exchange rate
   * @return Calculated exchange rate scaled by 1e18
   */
  function exchangeRateStored() external view returns (uint256);

  /**
   * @notice Returns the current per-block supply interest rate for this cToken
   * @return The supply interest rate per block, scaled by 1e18
   */
  function supplyRatePerBlock() external view returns (uint256);

  /// @dev Block number that interest was last accrued at
  function accrualBlockNumber() external view returns (uint256);

  function accrueInterest() external returns (uint256);

  function balanceOfUnderlying(address) external returns (uint256);

  function redeem(uint256 redeemTokens) external returns (uint256);

  function redeemUnderlying(uint256 redeemAmount) external returns (uint256);
}

interface ICTokenErc20 is ICToken {
  /// @dev Underlying asset for this CToken
  function underlying() external view returns (address);
}
