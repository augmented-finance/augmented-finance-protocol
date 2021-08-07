// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import '../../dependencies/openzeppelin/contracts/IERC20.sol';
import '../../interfaces/IVariableDebtToken.sol';
import '../../tools/math/WadRayMath.sol';
import '../../tools/upgradeability/VersionedInitializable.sol';
import './interfaces/PoolTokenConfig.sol';
import './base/PoolTokenBase.sol';
import './base/DebtTokenBase.sol';

/// @dev A variable debt token to track the borrowing positions of users
contract VariableDebtToken is DebtTokenBase, VersionedInitializable, IVariableDebtToken {
  using WadRayMath for uint256;

  uint256 private constant DEBT_TOKEN_REVISION = 0x1;

  function initialize(
    PoolTokenConfig memory config,
    string memory name,
    string memory symbol,
    uint8 decimals,
    bytes calldata params
  ) public override initializerRunAlways(DEBT_TOKEN_REVISION) {
    _initializeERC20(name, symbol, decimals);
    _initializePoolToken(config, name, symbol, decimals, params);
  }

  function getRevision() internal pure virtual override returns (uint256) {
    return DEBT_TOKEN_REVISION;
  }

  function balanceOf(address user)
    public
    view
    virtual
    override(IERC20, PoolTokenBase)
    returns (uint256)
  {
    uint256 scaledBalance = super.balanceOf(user);

    if (scaledBalance == 0) {
      return 0;
    }

    return scaledBalance.rayMul(_pool.getReserveNormalizedVariableDebt(_underlyingAsset));
  }

  function mint(
    address user,
    address onBehalfOf,
    uint256 amount,
    uint256 index
  ) external override onlyLendingPool returns (bool) {
    if (user != onBehalfOf) {
      _decreaseBorrowAllowance(onBehalfOf, user, amount);
    }

    uint256 previousBalance = super.balanceOf(onBehalfOf);
    uint256 amountScaled = amount.rayDiv(index);
    require(amountScaled != 0, Errors.CT_INVALID_MINT_AMOUNT);

    _mintBalance(onBehalfOf, amountScaled, index);

    emit Transfer(address(0), onBehalfOf, amount);
    emit Mint(user, onBehalfOf, amount, index);

    return previousBalance == 0;
  }

  function burn(
    address user,
    uint256 amount,
    uint256 index
  ) external override onlyLendingPool {
    uint256 amountScaled = amount.rayDiv(index);
    require(amountScaled != 0, Errors.CT_INVALID_BURN_AMOUNT);

    _burnBalance(user, amountScaled, index);

    emit Transfer(user, address(0), amount);
    emit Burn(user, amount, index);
  }

  function scaledBalanceOf(address user) public view virtual override returns (uint256) {
    return super.balanceOf(user);
  }

  function totalSupply() public view virtual override(IERC20, PoolTokenBase) returns (uint256) {
    return super.totalSupply().rayMul(_pool.getReserveNormalizedVariableDebt(_underlyingAsset));
  }

  function scaledTotalSupply() public view virtual override returns (uint256) {
    return super.totalSupply();
  }

  function getScaledUserBalanceAndSupply(address user)
    external
    view
    override
    returns (uint256, uint256)
  {
    return (super.balanceOf(user), super.totalSupply());
  }
}
