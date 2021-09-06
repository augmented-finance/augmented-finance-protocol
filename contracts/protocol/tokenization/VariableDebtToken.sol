// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../../dependencies/openzeppelin/contracts/IERC20.sol';
import '../../interfaces/IVariableDebtToken.sol';
import '../../tools/math/WadRayMath.sol';
import '../../tools/upgradeability/VersionedInitializable.sol';
import './interfaces/PoolTokenConfig.sol';
import './base/PoolTokenBase.sol';
import './base/DebtTokenBase.sol';
import '../../tools/tokens/ERC20DetailsBase.sol';

/**
 * @title VariableDebtToken
 * @notice Implements a variable debt token to track the borrowing positions of users
 * at variable rate mode
 **/
contract VariableDebtToken is DebtTokenBase, VersionedInitializable, IVariableDebtToken {
  using WadRayMath for uint256;

  constructor() PoolTokenBase(address(0), address(0)) ERC20DetailsBase('', '', 0) {}

  uint256 private constant DEBT_TOKEN_REVISION = 0x1;

  function getRevision() internal pure virtual override returns (uint256) {
    return DEBT_TOKEN_REVISION;
  }

  function initialize(
    PoolTokenConfig calldata config,
    string calldata name,
    string calldata symbol,
    bytes calldata params
  ) external override initializerRunAlways(DEBT_TOKEN_REVISION) {
    if (isRevisionInitialized(DEBT_TOKEN_REVISION)) {
      _initializeERC20(name, symbol, super.decimals());
    } else {
      _initializeERC20(name, symbol, config.underlyingDecimals);
      _initializePoolToken(config, params);
    }

    emit Initialized(
      config.underlyingAsset,
      address(config.pool),
      address(0),
      super.name(),
      super.symbol(),
      super.decimals(),
      params
    );
  }

  function getScaleIndex() public view override returns (uint256) {
    return _pool.getReserveNormalizedVariableDebt(_underlyingAsset);
  }

  function balanceOf(address user) public view virtual override returns (uint256) {
    uint256 scaledBalance = internalBalanceOf(user);
    if (scaledBalance == 0) {
      return 0;
    }
    return scaledBalance.rayMul(getScaleIndex());
  }

  function rewardedBalanceOf(address user) external view override returns (uint256) {
    return balanceOf(user);
  }

  function mint(
    address user,
    address onBehalfOf,
    uint256 amount,
    uint256 index
  ) external override onlyLendingPool returns (bool firstBalance) {
    if (user != onBehalfOf) {
      _decreaseBorrowAllowance(onBehalfOf, user, amount);
    }

    firstBalance = internalBalanceOf(onBehalfOf) == 0;
    uint256 amountScaled = amount.rayDiv(index);
    require(amountScaled != 0, Errors.CT_INVALID_MINT_AMOUNT);

    _mintBalance(onBehalfOf, amountScaled, index);

    emit Transfer(address(0), onBehalfOf, amount);
    emit Mint(user, onBehalfOf, amount, index);

    return firstBalance;
  }

  function burn(
    address user,
    uint256 amount,
    uint256 index
  ) external override onlyLendingPool {
    uint256 amountScaled = amount.rayDiv(index);
    require(amountScaled != 0, Errors.CT_INVALID_BURN_AMOUNT);

    _burnBalance(user, amountScaled, 0, index);

    emit Transfer(user, address(0), amount);
    emit Burn(user, amount, index);
  }

  function scaledBalanceOf(address user) public view virtual override returns (uint256) {
    return internalBalanceOf(user);
  }

  function totalSupply() public view virtual override returns (uint256) {
    return super.totalSupply().rayMul(getScaleIndex());
  }

  function scaledTotalSupply() public view virtual override returns (uint256) {
    return super.totalSupply();
  }

  function getScaledUserBalanceAndSupply(address user) external view override returns (uint256, uint256) {
    return (internalBalanceOf(user), super.totalSupply());
  }
}
