// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../dependencies/openzeppelin/contracts/Address.sol';
import '../dependencies/openzeppelin/contracts/IERC20.sol';
import '../dependencies/openzeppelin/contracts/SafeERC20.sol';
import './interfaces/IWETH.sol';
import './interfaces/IWETHGateway.sol';
import '../interfaces/ISweeper.sol';
import '../interfaces/ILendingPool.sol';
import '../interfaces/IDepositToken.sol';
import '../protocol/libraries/configuration/ReserveConfiguration.sol';
import '../protocol/libraries/configuration/UserConfiguration.sol';
import '../protocol/libraries/helpers/Helpers.sol';
import '../protocol/libraries/types/DataTypes.sol';
import '../access/MarketAccessBitmask.sol';
import '../access/interfaces/IMarketAccessController.sol';

contract WETHGateway is IWETHGateway, ISweeper, MarketAccessBitmask {
  using SafeERC20 for IERC20;

  using ReserveConfiguration for DataTypes.ReserveConfigurationMap;
  using UserConfiguration for DataTypes.UserConfigurationMap;

  // solhint-disable-next-line var-name-mixedcase
  IWETH internal immutable WETH;

  /**
   * @dev Sets the WETH address
   * @param weth Address of the Wrapped Ether contract
   **/
  constructor(IMarketAccessController acl, address weth) MarketAccessBitmask(acl) {
    WETH = IWETH(weth);
  }

  /**
   * @dev deposits WETH into the reserve, using native ETH. A corresponding amount of the overlying asset (depositTokens)
   * is minted.
   * @param lendingPool address of the targeted underlying lending pool
   * @param onBehalfOf address of the user who will receive the depositTokens representing the deposit
   * @param referralCode integrators are assigned a referral code and can potentially receive rewards.
   **/
  function depositETH(
    address lendingPool,
    address onBehalfOf,
    uint16 referralCode
  ) external payable override {
    WETH.deposit{value: msg.value}();
    WETH.approve(lendingPool, msg.value);
    ILendingPool(lendingPool).deposit(address(WETH), msg.value, onBehalfOf, referralCode);
  }

  /**
   * @dev withdraws the WETH _reserves of msg.sender.
   * @param lendingPool address of the targeted underlying lending pool
   * @param amount amount of aWETH to withdraw and receive native ETH
   * @param to address of the user who will receive native ETH
   */
  function withdrawETH(
    address lendingPool,
    uint256 amount,
    address to
  ) external override {
    IDepositToken aWETH = IDepositToken(ILendingPool(lendingPool).getReserveData(address(WETH)).depositTokenAddress);

    // if amount is equal to uint(-1), the user wants to redeem everything
    if (amount == type(uint256).max) {
      amount = aWETH.balanceOf(msg.sender);
    }
    IERC20(aWETH).safeTransferFrom(msg.sender, address(this), amount);
    ILendingPool(lendingPool).withdraw(address(WETH), amount, address(this));
    WETH.withdraw(amount);
    Address.sendValue(payable(to), amount);
  }

  /**
   * @dev repays a borrow on the WETH reserve, for the specified amount (or for the whole amount, if uint256(-1) is specified).
   * @param lendingPool address of the targeted underlying lending pool
   * @param amount the amount to repay, or uint256(-1) if the user wants to repay everything
   * @param rateMode the rate mode to repay
   * @param onBehalfOf the address for which msg.sender is repaying
   */
  function repayETH(
    address lendingPool,
    uint256 amount,
    uint256 rateMode,
    address onBehalfOf
  ) external payable override {
    (uint256 stableDebt, uint256 variableDebt) = Helpers.getUserCurrentDebtMemory(
      onBehalfOf,
      ILendingPool(lendingPool).getReserveData(address(WETH))
    );

    uint256 paybackAmount = DataTypes.InterestRateMode(rateMode) == DataTypes.InterestRateMode.STABLE
      ? stableDebt
      : variableDebt;

    if (amount < paybackAmount) {
      paybackAmount = amount;
    }
    require(msg.value >= paybackAmount, 'msg.value is less than repayment amount');
    WETH.deposit{value: paybackAmount}();
    WETH.approve(lendingPool, msg.value);
    ILendingPool(lendingPool).repay(address(WETH), msg.value, rateMode, onBehalfOf);

    // refund remaining dust eth
    if (msg.value > paybackAmount) {
      Address.sendValue(payable(msg.sender), msg.value - paybackAmount);
    }
  }

  /**
   * @dev borrow WETH, unwraps to ETH and send both the ETH and DebtTokens to msg.sender
   * via `approveDelegation` and onBehalf argument in `LendingPool.borrow`.
   * @param lendingPool address of the targeted underlying lending pool
   * @param amount the amount of ETH to borrow
   * @param interesRateMode the interest rate mode
   * @param referralCode integrators are assigned a referral code and can potentially receive rewards
   */
  function borrowETH(
    address lendingPool,
    uint256 amount,
    uint256 interesRateMode,
    uint16 referralCode
  ) external override {
    ILendingPool(lendingPool).borrow(address(WETH), amount, interesRateMode, referralCode, msg.sender);
    WETH.withdraw(amount);
    Address.sendValue(payable(msg.sender), amount);
  }

  /**
   * @dev transfer ERC20 from the utility contract, for ERC20 recovery in case of stuck tokens due
   * direct transfers to the contract address.
   * @param token token to transfer
   * @param to recipient of the transfer
   * @param amount amount to send
   */
  function sweepToken(
    address token,
    address to,
    uint256 amount
  ) external override onlySweepAdmin {
    IERC20(token).safeTransfer(to, amount);
  }

  /**
   * @dev transfer native Ether from the utility contract, for native Ether recovery in case of stuck Ether
   * due selfdestructs or transfer ether to pre-computated contract address before deployment.
   * @param to recipient of the transfer
   * @param amount amount to send
   */
  function sweepEth(address to, uint256 amount) external override onlySweepAdmin {
    Address.sendValue(payable(to), amount);
  }

  /**
   * @dev Get WETH address used by WETHGateway
   */
  function getWETHAddress() external view returns (address) {
    return address(WETH);
  }

  /// @dev Only WETH contract is allowed to transfer ETH here. Prevent other addresses to send Ether to this contract.
  receive() external payable {
    require(msg.sender == address(WETH), 'Receive not allowed');
  }

  /// @dev Revert fallback calls
  fallback() external payable {
    revert('Fallback not allowed');
  }
}
