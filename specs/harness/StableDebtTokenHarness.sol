pragma solidity 0.6.12;

import {StableDebtToken} from '../../contracts/protocol/tokenization/StableDebtToken.sol';
import {IncentivizedERC20} from '../../contracts/protocol/tokenization/IncentivizedERC20.sol';
import {ILendingPool} from '../../contracts/interfaces/ILendingPool.sol';
import {IBalanceHook} from '../../contracts/interfaces/IBalanceHook.sol';

contract StableDebtTokenHarness is StableDebtToken {
  constructor(
    address pool,
    address underlyingAsset,
    string memory name,
    string memory symbol,
    address incentivesController
  ) public {
    StableDebtToken.initialize(ILendingPool(pool), underlyingAsset, IBalanceHook(incentivesController), 18, name, symbol, "");
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
