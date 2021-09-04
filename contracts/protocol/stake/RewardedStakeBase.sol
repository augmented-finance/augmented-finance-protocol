// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../../dependencies/openzeppelin/contracts/Address.sol';
import '../../dependencies/openzeppelin/contracts/IERC20.sol';
import '../../dependencies/openzeppelin/contracts/SafeERC20.sol';
import '../../reward/calcs/CalcLinearWeightedReward.sol';
import '../../reward/pools/ControlledRewardPool.sol';
import '../../tools/tokens/ERC20DetailsBase.sol';
import '../../tools/tokens/ERC20AllowanceBase.sol';
import '../../tools/tokens/ERC20TransferBase.sol';
import '../../tools/tokens/ERC20PermitBase.sol';
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

abstract contract RewardedBase is
  IERC20,
  SlashableBase,
  CooldownBase,
  CalcLinearWeightedReward,
  ControlledRewardPool,
  IInitializableStakeToken,
  ERC20DetailsBase,
  ERC20AllowanceBase,
  ERC20TransferBase,
  ERC20PermitBase
{
  using WadRayMath for uint256;
  using PercentageMath for uint256;
  using SafeERC20 for IERC20;

  IERC20 private _stakedToken;
  IUnderlyingStrategy private _strategy;

  function _approveTransferFrom(address owner, uint256 amount)
    internal
    override(ERC20AllowanceBase, ERC20TransferBase)
  {
    ERC20AllowanceBase._approveTransferFrom(owner, amount);
  }

  function getAccessController() internal view override returns (IMarketAccessController) {
    return _remoteAcl;
  }

  // function _initializeToken(StakeTokenConfig memory params) internal virtual {
  //   _remoteAcl = params.stakeController;
  //   _stakedToken = params.stakedToken;
  //   _strategy = params.strategy;
  //   _initializeSlashable(params.maxSlashable);

  //   if (params.unstakePeriod == 0) {
  //     params.unstakePeriod = MIN_UNSTAKE_PERIOD;
  //   }
  //   internalSetCooldown(params.cooldownPeriod, params.unstakePeriod);
  // }

  // solhint-disable-next-line func-name-mixedcase
  function UNDERLYING_ASSET_ADDRESS() external view override returns (address) {
    return address(_stakedToken);
  }

  function stake(
    address to,
    uint256 underlyingAmount,
    uint256 referral
  ) external override returns (uint256) {
    return internalStake(msg.sender, to, underlyingAmount, referral);
  }

  function internalStake(
    address from,
    address to,
    uint256 underlyingAmount,
    uint256 referral
  ) internal notPaused returns (uint256 stakeAmount) {
    require(underlyingAmount > 0, Errors.VL_INVALID_AMOUNT);

    stakeAmount = underlyingAmount.rayDiv(exchangeRate());
    (uint256 toBalance, uint32 toCooldown) = internalBalanceAndCooldownOf(to);

    toCooldown = getNextCooldown(0, stakeAmount, toBalance, toCooldown);

    _stakedToken.safeTransferFrom(from, address(this), underlyingAmount);

    doIncrementRewardBalance(to, stakeAmount);
    super.internalSetRewardEntryCustom(to, toCooldown);

    emit Staked(from, to, underlyingAmount, referral);
    return stakeAmount;
  }

  function internalBalanceAndCooldownOf(address holder) internal view returns (uint256, uint32) {
    RewardBalance memory balance = super.getRewardEntry(holder);
    return (balance.rewardBase, balance.custom);
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
  ) internal notPaused returns (uint256, uint256) {
    _ensureCooldown(from);

    (uint256 oldBalance, uint32 cooldownFrom) = internalBalanceAndCooldownOf(from);
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

    doDecrementRewardBalance(from, stakeAmount, 0);
    if (oldBalance == stakeAmount && cooldownFrom != 0) {
      super.internalSetRewardEntryCustom(from, 0);
    }

    IERC20(_stakedToken).safeTransfer(to, underlyingAmount);

    emit Redeemed(from, to, stakeAmount, underlyingAmount);
    return (stakeAmount, underlyingAmount);
  }

  function balanceOf(address account) public view virtual override returns (uint256) {
    return super.getRewardEntry(account).rewardBase;
  }

  function totalSupply() public view override returns (uint256) {
    return super.internalGetTotalSupply();
  }

  /// @dev Activates the cooldown period to unstake. Reverts if the user has no stake.
  function cooldown() external override {
    require(balanceOf(msg.sender) != 0, Errors.STK_INVALID_BALANCE_ON_COOLDOWN);

    super.internalSetRewardEntryCustom(msg.sender, uint32(block.timestamp));
    emit CooldownStarted(msg.sender, uint32(block.timestamp));
  }

  function getCooldown(address holder) public view override(CooldownBase, IStakeToken) returns (uint32) {
    return super.getRewardEntry(holder).custom;
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
    windowStart = getCooldown(holder);
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
    super.internalSetCooldown(cooldownPeriod, unstakePeriod);
  }

  function isRedeemable() external view override returns (bool) {
    return super.isPaused();
  }

  function setRedeemable(bool redeemable) external override aclHas(AccessFlags.LIQUIDITY_CONTROLLER) {
    super.internalPause(!redeemable);
    emit RedeemUpdated(redeemable);
  }

  function getUnderlying() internal view returns (address) {
    return address(_stakedToken);
  }

  function transferBalance(
    address from,
    address to,
    uint256 amount
  ) internal override {
    (uint256 balanceFrom, uint32 cooldownFrom) = internalBalanceAndCooldownOf(from);

    super.doDecrementRewardBalance(from, amount, 0);
    // if cooldown was set and whole balance of sender was transferred - clear cooldown
    if (balanceFrom == amount && cooldownFrom != 0) {
      super.internalSetRewardEntryCustom(from, 0);
    }

    (uint256 balanceTo, uint32 cooldownTo) = internalBalanceAndCooldownOf(to);
    uint32 newCooldownTo = getNextCooldown(cooldownFrom, amount, balanceTo, cooldownTo);

    super.doIncrementRewardBalance(to, amount);
    if (newCooldownTo != cooldownTo) {
      super.internalSetRewardEntryCustom(to, newCooldownTo);
    }
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

  function setIncentivesController(address) external view override onlyRewardConfiguratorOrAdmin {
    revert('unsupported');
  }

  function getIncentivesController() public view override returns (address) {
    return address(this);
  }
}
