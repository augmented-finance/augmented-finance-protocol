// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import './IScaledBalanceToken.sol';
import '../dependencies/openzeppelin/contracts/IERC20.sol';
import './IPoolToken.sol';

/// @dev Defines the basic interface for a variable debt token.
interface IVariableDebtToken is IPoolToken, IScaledBalanceToken {
  /**
   * @dev Emitted after the mint action
   * @param from The address performing the mint
   * @param onBehalfOf The address of the user on which behalf minting has been performed
   * @param value The amount to be minted
   * @param index The last index of the reserve
   **/
  event Mint(address indexed from, address indexed onBehalfOf, uint256 value, uint256 index);

  /// @dev Mints debt token to the `onBehalfOf` address. Returns `true` when balance of the `onBehalfOf` was 0
  function mint(
    address user,
    address onBehalfOf,
    uint256 amount,
    uint256 index
  ) external returns (bool);

  /**
   * @dev Emitted when variable debt is burnt
   * @param user The user which debt has been burned
   * @param amount The amount of debt being burned
   * @param index The index of the user
   **/
  event Burn(address indexed user, uint256 amount, uint256 index);

  /// @dev Burns user variable debt
  function burn(
    address user,
    uint256 amount,
    uint256 index
  ) external;
}
