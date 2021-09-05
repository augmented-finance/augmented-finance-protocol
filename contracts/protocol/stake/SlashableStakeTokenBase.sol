// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../../dependencies/openzeppelin/contracts/Address.sol';
import '../../dependencies/openzeppelin/contracts/IERC20.sol';
import '../../dependencies/openzeppelin/contracts/SafeERC20.sol';
import '../../tools/tokens/ERC20BaseWithPermit.sol';
import '../../tools/math/WadRayMath.sol';
import '../../tools/math/PercentageMath.sol';
import '../../tools/Errors.sol';
import '../../interfaces/IBalanceHook.sol';
import '../libraries/helpers/UnderlyingHelper.sol';
import '../../access/AccessFlags.sol';
import '../../access/MarketAccessBitmask.sol';
import '../../access/interfaces/IMarketAccessController.sol';
import './interfaces/StakeTokenConfig.sol';
import './interfaces/IInitializableStakeToken.sol';
import './CooldownBase.sol';
import './SlashableBase.sol';

abstract contract SlashableStakeTokenBase is
  SlashableBase,
  CooldownBase,
  ERC20BaseWithPermit,
  IInitializableStakeToken
{
  using WadRayMath for uint256;
  using PercentageMath for uint256;
  using SafeERC20 for IERC20;

  IERC20 private _stakedToken;
  IBalanceHook internal _incentivesController;
  IUnderlyingStrategy private _strategy;
  bool private _redeemPaused;

  mapping(address => uint32) private _stakersCooldowns;

  function _initializeToken(StakeTokenConfig memory params) internal virtual {
    _remoteAcl = params.stakeController;
    _stakedToken = params.stakedToken;
    _strategy = params.strategy;
    _initializeSlashable(params.maxSlashable);

    if (params.unstakePeriod == 0) {
      params.unstakePeriod = MIN_UNSTAKE_PERIOD;
    }
    internalSetCooldown(params.cooldownPeriod, params.unstakePeriod);
  }

  // solhint-disable-next-line func-name-mixedcase
  function UNDERLYING_ASSET_ADDRESS() external view override returns (address) {
    return address(_stakedToken);
  }

  function stake(
    address to,
    uint256 underlyingAmount,
    uint256 referral
  ) external override returns (uint256) {
    return internalStake(msg.sender, to, underlyingAmount, referral, true);
  }

  function internalStake(
    address from,
    address to,
    uint256 underlyingAmount,
    uint256 referral,
    bool transferFrom
  ) internal returns (uint256 stakeAmount) {
    require(underlyingAmount > 0, Errors.VL_INVALID_AMOUNT);
    uint256 oldReceiverBalance = balanceOf(to);
    stakeAmount = underlyingAmount.rayDiv(exchangeRate());

    _stakersCooldowns[to] = getNextCooldown(0, stakeAmount, oldReceiverBalance, _stakersCooldowns[to]);

    if (transferFrom) {
      _stakedToken.safeTransferFrom(from, address(this), underlyingAmount);
    }
    _mint(to, stakeAmount);

    if (address(_incentivesController) != address(0)) {
      _incentivesController.handleBalanceUpdate(address(this), to, oldReceiverBalance, balanceOf(to), totalSupply());
    }

    emit Staked(from, to, underlyingAmount, referral);
    return stakeAmount;
  }

  function redeem(address to, uint256 stakeAmount) external override returns (uint256 stakeAmount_) {
    require(stakeAmount > 0, Errors.VL_INVALID_AMOUNT);
    (stakeAmount_, ) = internalRedeem(msg.sender, to, stakeAmount, 0);
    return stakeAmount_;
  }

  function redeemUnderlying(address to, uint256 underlyingAmount)
    external
    override
    returns (uint256 underlyingAmount_)
  {
    require(underlyingAmount > 0, Errors.VL_INVALID_AMOUNT);
    (, underlyingAmount_) = internalRedeem(msg.sender, to, 0, underlyingAmount);
    return underlyingAmount_;
  }

  function internalRedeem(
    address from,
    address to,
    uint256 stakeAmount,
    uint256 underlyingAmount
  ) internal returns (uint256, uint256) {
    require(!_redeemPaused, Errors.STK_REDEEM_PAUSED);
    _ensureCooldown(from);

    uint256 oldBalance = balanceOf(from);
    if (stakeAmount == 0) {
      uint256 rate = exchangeRate();
      stakeAmount = underlyingAmount.rayDiv(rate);

      if (stakeAmount == 0) {
        // don't allow tiny withdrawals
        return (0, 0);
      }
      if (stakeAmount > oldBalance) {
        stakeAmount = oldBalance;
        underlyingAmount = stakeAmount.rayMul(rate);
      }
    } else {
      if (stakeAmount > oldBalance) {
        stakeAmount = oldBalance;
      }
      underlyingAmount = stakeAmount.rayMul(exchangeRate());
      if (underlyingAmount == 0) {
        // protect the user - don't waste balance without an outcome
        return (0, 0);
      }
    }

    _burn(from, stakeAmount);

    if (oldBalance == stakeAmount) {
      delete (_stakersCooldowns[from]);
    }

    if (address(_incentivesController) != address(0)) {
      _incentivesController.handleBalanceUpdate(address(this), from, oldBalance, balanceOf(from), totalSupply());
    }

    IERC20(_stakedToken).safeTransfer(to, underlyingAmount);

    emit Redeemed(from, to, stakeAmount, underlyingAmount);
    return (stakeAmount, underlyingAmount);
  }

  function internalTotalSupply() internal view override returns (uint256) {
    return super.totalSupply();
  }

  /// @dev Activates the cooldown period to unstake. Reverts if the user has no stake.
  function cooldown() external override {
    require(balanceOf(msg.sender) != 0, Errors.STK_INVALID_BALANCE_ON_COOLDOWN);

    _stakersCooldowns[msg.sender] = uint32(block.timestamp);
    emit CooldownStarted(msg.sender, uint32(block.timestamp));
  }

  function getCooldown(address holder) public view override(CooldownBase, IStakeToken) returns (uint32) {
    return _stakersCooldowns[holder];
  }

  function balanceAndCooldownOf(address holder)
    external
    view
    override
    returns (
      uint256,
      uint32 windowStart,
      uint32 windowEnd
    )
  {
    windowStart = _stakersCooldowns[holder];
    if (windowStart != 0) {
      windowStart += uint32(COOLDOWN_PERIOD());
      unchecked {
        windowEnd = windowStart + uint32(UNSTAKE_PERIOD());
      }
      if (windowEnd < windowStart) {
        windowEnd = type(uint32).max;
      }
    }
    return (balanceOf(holder), windowStart, windowEnd);
  }

  function internalTransferUnderlying(address destination, uint256 amount) internal override {
    if (address(_strategy) == address(0)) {
      _stakedToken.safeTransfer(destination, amount);
    } else {
      amount = UnderlyingHelper.delegateWithdrawUnderlying(_strategy, address(_stakedToken), amount, destination);
    }
  }

  function setCooldown(uint32 cooldownPeriod, uint32 unstakePeriod)
    external
    override
    aclHas(AccessFlags.STAKE_ADMIN | AccessFlags.STAKE_CONFIGURATOR)
  {
    internalSetCooldown(cooldownPeriod, unstakePeriod);
  }

  function isRedeemable() external view override returns (bool) {
    return !_redeemPaused;
  }

  function setRedeemable(bool redeemable) external override aclHas(AccessFlags.LIQUIDITY_CONTROLLER) {
    _redeemPaused = !redeemable;
    emit RedeemableUpdated(redeemable);
  }

  function setPaused(bool paused) external override {
    AccessHelper.requireAnyOf(_remoteAcl, msg.sender, AccessFlags.EMERGENCY_ADMIN, Errors.CALLER_NOT_EMERGENCY_ADMIN);
    _redeemPaused = paused;
    emit RedeemableUpdated(!paused);
    emit EmergencyPaused(msg.sender, paused);
  }

  function isPaused() external view override returns (bool) {
    return _redeemPaused;
  }

  function getUnderlying() internal view returns (address) {
    return address(_stakedToken);
  }

  function _transfer(
    address from,
    address to,
    uint256 amount
  ) internal override {
    uint256 balanceOfFrom = balanceOf(from);

    // Recipient
    if (from != to) {
      uint256 balanceOfTo = balanceOf(to);

      uint32 previousSenderCooldown = _stakersCooldowns[from];
      _stakersCooldowns[to] = getNextCooldown(previousSenderCooldown, amount, balanceOfTo, _stakersCooldowns[to]);

      // if cooldown was set and whole balance of sender was transferred - clear cooldown
      if (balanceOfFrom == amount && previousSenderCooldown != 0) {
        delete (_stakersCooldowns[from]);
      }
    }

    super._transfer(from, to, amount);
  }

  function initializedStakeTokenWith()
    external
    view
    override
    returns (
      StakeTokenConfig memory params,
      string memory name_,
      string memory symbol_
    )
  {
    params.stakeController = _remoteAcl;
    params.stakedToken = _stakedToken;
    params.cooldownPeriod = uint32(super.COOLDOWN_PERIOD());
    params.unstakePeriod = uint32(super.UNSTAKE_PERIOD());
    params.maxSlashable = super.getMaxSlashablePercentage();
    params.stakedTokenDecimals = super.decimals();
    return (params, super.name(), super.symbol());
  }

  function setIncentivesController(address addr) external override onlyRewardConfiguratorOrAdmin {
    _incentivesController = IBalanceHook(addr);
  }

  function getIncentivesController() public view override returns (address) {
    return address(_incentivesController);
  }
}
