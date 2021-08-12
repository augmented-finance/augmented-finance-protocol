// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../../contracts/protocol/tokenization/StableDebtToken.sol';
import '../../contracts/protocol/tokenization/IncentivizedERC20.sol';
import '../../contracts/interfaces/ILendingPool.sol';
import '../../contracts/interfaces/IBalanceHook.sol';
import '../../contracts/protocol/tokenization/interfaces/PoolTokenConfig.sol';

contract StableDebtTokenHarness is StableDebtToken {
  constructor(
    PoolTokenConfig memory config,
    string memory name,
    string memory symbol
  ) public {
    StableDebtToken.initialize(config, name, symbol, 18, '');
  }

  /**
   Simplification: The user accumulates no interest (the balance increase is always 0).
   **/
  function balanceOf(address account) public view override returns (uint256) {
    return IncentivizedERC20.balanceOf(account);
  }

  function _calcTotalSupply(uint256 avgRate) internal view override returns (uint256) {
    avgRate;
    return IncentivizedERC20.totalSupply();
  }

  function rayWadMul(uint256 aRay, uint256 bWad) external view returns (uint256) {
    aRay;
    bWad;
    this;
    return aRay.rayMul(bWad.wadToRay());
  }
}
