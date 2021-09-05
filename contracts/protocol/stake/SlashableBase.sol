// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../../dependencies/openzeppelin/contracts/IERC20.sol';
import '../../tools/math/WadRayMath.sol';
import '../../tools/math/PercentageMath.sol';
import '../../access/AccessFlags.sol';
import '../../access/MarketAccessBitmask.sol';
import './interfaces/IStakeToken.sol';
import './interfaces/IManagedStakeToken.sol';

abstract contract SlashableBase is IERC20, IStakeToken, IManagedStakeToken, MarketAccessBitmaskMin {
  using AccessHelper for IMarketAccessController;
  using WadRayMath for uint256;
  using PercentageMath for uint256;

  uint96 private _exchangeRate = uint96(WadRayMath.RAY); // RAY >= _exchangeRate > 0
  uint16 private _maxSlashablePercentage;

  constructor(uint16 maxSlashablePercentage) {
    _initializeSlashable(maxSlashablePercentage);
  }

  function _initializeSlashable(uint16 maxSlashablePercentage) internal {
    _exchangeRate = uint96(WadRayMath.RAY);

    if (maxSlashablePercentage >= PercentageMath.HALF_ONE) {
      _maxSlashablePercentage = PercentageMath.HALF_ONE;
    } else {
      _maxSlashablePercentage = maxSlashablePercentage;
    }
  }

  function exchangeRate() public view virtual override returns (uint256) {
    return _exchangeRate;
  }

  function internalExchangeRate() internal view virtual returns (uint256, uint256) {
    return (_exchangeRate, WadRayMath.RAY);
  }

  function internalTotalSupply() internal view virtual returns (uint256);

  function slashUnderlying(
    address destination,
    uint256 minAmount,
    uint256 maxAmount
  ) external virtual override onlyLiquidityController returns (uint256 amount, bool erc20Transfer) {
    uint256 totalSupply;
    (amount, totalSupply) = internalSlash(minAmount, maxAmount);
    if (amount > 0) {
      erc20Transfer = internalTransferSlashedUnderlying(destination, amount);
      emit Slashed(destination, amount, totalSupply);
    }
    return (amount, erc20Transfer);
  }

  function internalSlash(uint256 minAmount, uint256 maxAmount) internal returns (uint256 amount, uint256 totalSupply) {
    totalSupply = internalTotalSupply();
    uint256 scaledSupply = totalSupply.rayMul(_exchangeRate);
    uint256 maxSlashable = scaledSupply.percentMul(_maxSlashablePercentage);

    if (maxAmount >= maxSlashable) {
      amount = maxSlashable;
    } else {
      amount = maxAmount;
    }
    if (amount < minAmount) {
      return (0, totalSupply);
    }

    uint96 newExchangeRate;
    unchecked {
      newExchangeRate = uint96(((scaledSupply - amount) * WadRayMath.RAY) / totalSupply);
      totalSupply = totalSupply.rayMul(newExchangeRate);
      amount = scaledSupply - totalSupply;
    }
    _exchangeRate = newExchangeRate;

    return (amount, totalSupply);
  }

  function internalTransferSlashedUnderlying(address destination, uint256 amount)
    internal
    virtual
    returns (bool erc20Transfer);

  function getMaxSlashablePercentage() public view override returns (uint16) {
    return _maxSlashablePercentage;
  }

  modifier onlyStakeAdminOrConfigurator() {
    _remoteAcl.requireAnyOf(
      msg.sender,
      AccessFlags.STAKE_ADMIN | AccessFlags.STAKE_CONFIGURATOR,
      Errors.CALLER_NOT_STAKE_ADMIN
    );
    _;
  }

  modifier onlyLiquidityController() {
    _remoteAcl.requireAnyOf(msg.sender, AccessFlags.LIQUIDITY_CONTROLLER, Errors.CALLER_NOT_LIQUIDITY_CONTROLLER);
    _;
  }

  function setMaxSlashablePercentage(uint16 slashPct) external override onlyStakeAdminOrConfigurator {
    require(slashPct <= PercentageMath.HALF_ONE, Errors.STK_EXCESSIVE_SLASH_PCT);
    _maxSlashablePercentage = slashPct;
    emit MaxSlashUpdated(slashPct);
  }
}
