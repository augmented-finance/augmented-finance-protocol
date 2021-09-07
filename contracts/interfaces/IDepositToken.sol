// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../dependencies/openzeppelin/contracts/IERC20.sol';
import './IScaledBalanceToken.sol';
import './IPoolToken.sol';

interface IDepositToken is IERC20, IPoolToken, IScaledBalanceToken {
  /**
   * @dev Emitted on mint
   * @param account The receiver of minted tokens
   * @param value The amount minted
   * @param index The new liquidity index of the reserve
   **/
  event Mint(address indexed account, uint256 value, uint256 index);

  /**
   * @dev Mints `amount` depositTokens to `user`
   * @param user The address receiving the minted tokens
   * @param amount The amount of tokens getting minted
   * @param index The new liquidity index of the reserve
   * @param repayOverdraft Enables to use this amount cover an overdraft
   * @return `true` if the the previous balance of the user was 0
   */
  function mint(
    address user,
    uint256 amount,
    uint256 index,
    bool repayOverdraft
  ) external returns (bool);

  /**
   * @dev Emitted on burn
   * @param account The owner of tokens burned
   * @param target The receiver of the underlying
   * @param value The amount burned
   * @param index The new liquidity index of the reserve
   **/
  event Burn(address indexed account, address indexed target, uint256 value, uint256 index);

  /**
   * @dev Emitted on transfer
   * @param from The sender
   * @param to The recipient
   * @param value The amount transferred
   * @param index The new liquidity index of the reserve
   **/
  event BalanceTransfer(address indexed from, address indexed to, uint256 value, uint256 index);

  /**
   * @dev Burns depositTokens from `user` and sends the equivalent amount of underlying to `receiverOfUnderlying`
   * @param user The owner of the depositTokens, getting them burned
   * @param receiverOfUnderlying The address that will receive the underlying
   * @param amount The amount being burned
   * @param index The new liquidity index of the reserve
   **/
  function burn(
    address user,
    address receiverOfUnderlying,
    uint256 amount,
    uint256 index
  ) external;

  /**
   * @dev Mints depositTokens to the reserve treasury
   * @param amount The amount of tokens getting minted
   * @param index The new liquidity index of the reserve
   */
  function mintToTreasury(uint256 amount, uint256 index) external;

  /**
   * @dev Transfers depositTokens in the event of a borrow being liquidated, in case the liquidators reclaims the depositToken
   * @param from The address getting liquidated, current owner of the depositTokens
   * @param to The recipient
   * @param value The amount of tokens getting transferred
   * @param index The liquidity index of the reserve
   * @param transferUnderlying is true when the underlying should be, otherwise the depositToken
   * @return true when transferUnderlying is false and the recipient had zero balance
   **/
  function transferOnLiquidation(
    address from,
    address to,
    uint256 value,
    uint256 index,
    bool transferUnderlying
  ) external returns (bool);

  /**
   * @dev Transfers the underlying asset to `target`. Used by the LendingPool to transfer
   * assets in borrow(), withdraw() and flashLoan()
   * @param user The recipient of the underlying
   * @param amount The amount getting transferred
   * @return The amount transferred
   **/
  function transferUnderlyingTo(address user, uint256 amount) external returns (uint256);

  function collateralBalanceOf(address) external view returns (uint256);

  /**
   * @dev Emitted on use of overdraft (by liquidation)
   * @param account The receiver of overdraft (user with shortage)
   * @param value The amount received
   * @param index The liquidity index of the reserve
   **/
  event OverdraftApplied(address indexed account, uint256 value, uint256 index);

  /**
   * @dev Emitted on return of overdraft allowance when it was fully or partially used
   * @param provider The provider of overdraft
   * @param recipient The receiver of overdraft
   * @param overdraft The amount overdraft that was covered by the provider
   * @param index The liquidity index of the reserve
   **/
  event OverdraftCovered(address indexed provider, address indexed recipient, uint256 overdraft, uint256 index);

  event SubBalanceProvided(address indexed provider, address indexed recipient, uint256 amount, uint256 index);
  event SubBalanceReturned(address indexed provider, address indexed recipient, uint256 amount, uint256 index);
  event SubBalanceLocked(address indexed provider, uint256 amount, uint256 index);
  event SubBalanceUnlocked(address indexed provider, uint256 amount, uint256 index);

  function updateTreasury() external;

  function addSubBalanceOperator(address addr) external;

  function addStakeOperator(address addr) external;

  function removeSubBalanceOperator(address addr) external;

  function provideSubBalance(
    address provider,
    address recipient,
    uint256 scaledAmount
  ) external;

  function returnSubBalance(
    address provider,
    address recipient,
    uint256 scaledAmount,
    bool preferOverdraft
  ) external returns (uint256 coveredOverdraft);

  function lockSubBalance(address provider, uint256 scaledAmount) external;

  function unlockSubBalance(
    address provider,
    uint256 scaledAmount,
    address transferTo
  ) external;

  function replaceSubBalance(
    address prevProvider,
    address recipient,
    uint256 prevScaledAmount,
    address newProvider,
    uint256 newScaledAmount
  ) external returns (uint256 coveredOverdraftByPrevProvider);

  function transferLockedBalance(
    address from,
    address to,
    uint256 scaledAmount
  ) external;
}
