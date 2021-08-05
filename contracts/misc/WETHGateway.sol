// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import '../dependencies/openzeppelin/contracts/IERC20.sol';
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
  using ReserveConfiguration for DataTypes.ReserveConfigurationMap;
  using UserConfiguration for DataTypes.UserConfigurationMap;

  IWETH internal immutable WETH;

  constructor(IMarketAccessController acl, address weth) public MarketAccessBitmask(acl) {
    WETH = IWETH(weth);
  }

  function depositETH(
    address lendingPool,
    address onBehalfOf,
    uint16 referralCode
  ) external payable override {
    WETH.deposit{value: msg.value}();
    WETH.approve(lendingPool, msg.value);
    ILendingPool(lendingPool).deposit(address(WETH), msg.value, onBehalfOf, referralCode);
  }

  function withdrawETH(
    address lendingPool,
    uint256 amount,
    address to
  ) external override {
    IDepositToken aWETH =
      IDepositToken(ILendingPool(lendingPool).getReserveData(address(WETH)).depositTokenAddress);

    // if amount is equal to uint(-1), the user wants to redeem everything
    if (amount == type(uint256).max) {
      amount = aWETH.balanceOf(msg.sender);
    }
    aWETH.transferFrom(msg.sender, address(this), amount);
    ILendingPool(lendingPool).withdraw(address(WETH), amount, address(this));
    WETH.withdraw(amount);
    _safeTransferETH(to, amount);
  }

  function repayETH(
    address lendingPool,
    uint256 amount,
    uint256 rateMode,
    address onBehalfOf
  ) external payable override {
    (uint256 stableDebt, uint256 variableDebt) =
      Helpers.getUserCurrentDebtMemory(
        onBehalfOf,
        ILendingPool(lendingPool).getReserveData(address(WETH))
      );

    uint256 paybackAmount =
      DataTypes.InterestRateMode(rateMode) == DataTypes.InterestRateMode.STABLE
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
    if (msg.value > paybackAmount) _safeTransferETH(msg.sender, msg.value - paybackAmount);
  }

  function borrowETH(
    address lendingPool,
    uint256 amount,
    uint256 interesRateMode,
    uint16 referralCode
  ) external override {
    ILendingPool(lendingPool).borrow(
      address(WETH),
      amount,
      interesRateMode,
      referralCode,
      msg.sender
    );
    WETH.withdraw(amount);
    _safeTransferETH(msg.sender, amount);
  }

  function _safeTransferETH(address to, uint256 value) internal {
    (bool success, ) = to.call{value: value}(new bytes(0));
    require(success, 'ETH_TRANSFER_FAILED');
  }

  function sweepToken(
    address token,
    address to,
    uint256 amount
  ) external override onlySweepAdmin {
    IERC20(token).transfer(to, amount);
  }

  function sweepEth(address to, uint256 amount) external override onlySweepAdmin {
    _safeTransferETH(to, amount);
  }

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
