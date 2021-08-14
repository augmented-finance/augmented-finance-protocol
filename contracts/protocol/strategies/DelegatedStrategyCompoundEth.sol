// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../../tools/math/WadRayMath.sol';
import '../../dependencies/openzeppelin/contracts/SafeERC20.sol';
import '../../dependencies/openzeppelin/contracts/IERC20.sol';
import '../../dependencies/compound-protocol/contracts/ICToken.sol';
import '../../misc/interfaces/IWETH.sol';
import '../../interfaces/IPoolToken.sol';
import '../../interfaces/IDerivedToken.sol';
import './DelegatedStrategyCompoundBase.sol';

contract DelegatedStrategyCompoundEth is DelegatedStrategyCompoundBase {
  using SafeERC20 for IERC20;

  IWETH private immutable _weth;

  constructor(string memory name, address weth) DelegatedStrategyCompoundBase(name) {
    _weth = IWETH(weth);
  }

  function getUnderlying(address) external view override returns (address) {
    return address(_weth);
  }

  function internalWithdrawUnderlying(
    address asset,
    uint256 amount,
    address to
  ) internal override returns (uint256) {
    uint256 balanceBefore = address(this).balance;
    amount = internalRedeem(asset, amount);
    require(address(this).balance >= balanceBefore + amount, 'CToken: redeem inconsistent');

    if (amount == 0) {
      return 0;
    }

    _weth.deposit{value: amount}();
    if (to != address(this)) {
      IERC20(address(_weth)).safeTransfer(to, amount);
    }

    return amount;
  }
}
