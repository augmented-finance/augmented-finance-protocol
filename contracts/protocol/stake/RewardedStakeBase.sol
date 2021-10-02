// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../../dependencies/openzeppelin/contracts/SafeERC20.sol';
import '../../reward/interfaces/IInitializableRewardPool.sol';
import '../../reward/calcs/CalcLinearWeightedReward.sol';
import '../../reward/pools/ControlledRewardPool.sol';
import '../../tools/tokens/ERC20DetailsBase.sol';
import '../../tools/tokens/ERC20AllowanceBase.sol';
import '../../tools/tokens/ERC20TransferBase.sol';
import '../../tools/tokens/ERC20PermitBase.sol';
import '../../tools/math/WadRayMath.sol';
import '../../tools/math/PercentageMath.sol';
import '../../tools/Errors.sol';
import '../libraries/helpers/UnderlyingHelper.sol';
import './interfaces/StakeTokenConfig.sol';
import './interfaces/IInitializableStakeToken.sol';
import './CooldownBase.sol';
import './SlashableBase.sol';

abstract contract RewardedStakeBase is
  SlashableBase,
  CooldownBase,
  CalcLinearWeightedReward,
  ControlledRewardPool,
  IInitializableStakeToken,
  ERC20DetailsBase,
  ERC20AllowanceBase,
  ERC20TransferBase,
  ERC20PermitBase,
  IInitializableRewardPool
{
  using WadRayMath for uint256;
  using PercentageMath for uint256;
  using SafeERC20 for IERC20;

  bool private _notRedeemable;
  IERC20 private _stakedToken;
  IUnderlyingStrategy private _strategy;

  function _approveTransferFrom(address owner, uint256 amount)
    internal
    override(ERC20AllowanceBase, ERC20TransferBase)
  {
    ERC20AllowanceBase._approveTransferFrom(owner, amount);
  }

  function _approveByPermit(
    address owner,
    address spender,
    uint256 amount
  ) internal override {
    _approve(owner, spender, amount);
  }

  function _getPermitDomainName() internal view override returns (bytes memory) {
    return bytes(super.name());
  }

  function getAccessController() internal view override returns (IMarketAccessController) {
    return _remoteAcl;
  }

  function _notSupported() private pure {
    revert('UNSUPPORTED');
  }

  function addRewardProvider(address, address) external view override onlyConfigAdmin {
    _notSupported();
  }

  function removeRewardProvider(address provider) external override onlyConfigAdmin {}

  function internalGetRate() internal view override returns (uint256) {
    return super.getLinearRate();
  }

  function internalSetRate(uint256 rate) internal override {
    super.setLinearRate(rate);
  }

  function internalTotalSupply() internal view override returns (uint256) {
    return super.internalGetTotalSupply();
  }

  function getIncentivesController() public view override returns (address) {
    return address(this);
  }

  function setIncentivesController(address) external view override onlyRewardConfiguratorOrAdmin {
    _notSupported();
  }

  function getCurrentTick() internal view override returns (uint32) {
    return uint32(block.timestamp);
  }

  function internalGetReward(address holder)
    internal
    override
    returns (
      uint256,
      uint32,
      bool
    )
  {
    return doGetReward(holder);
  }

  function internalCalcReward(address holder, uint32 at) internal view override returns (uint256, uint32) {
    return doCalcRewardAt(holder, at);
  }

  function getPoolName() public view virtual override returns (string memory) {
    return super.symbol();
  }

  function initializeRewardPool(InitRewardPoolData calldata config) external override onlyRewardConfiguratorOrAdmin {
    require(address(config.controller) != address(0));
    require(address(getRewardController()) == address(0));
    _initialize(IRewardController(config.controller), 0, config.baselinePercentage, config.poolName);
  }

  function initializedRewardPoolWith() external view override returns (InitRewardPoolData memory) {
    return InitRewardPoolData(IRewardController(getRewardController()), getPoolName(), getBaselinePercentage());
  }

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
    return internalStake(msg.sender, to, underlyingAmount, referral);
  }

  function internalStake(
    address from,
    address to,
    uint256 underlyingAmount,
    uint256 referral
  ) internal notPausedCustom(Errors.STK_PAUSED) returns (uint256 stakeAmount) {
    require(underlyingAmount > 0, Errors.VL_INVALID_AMOUNT);

    (uint256 exchangeRate, uint256 index) = internalExchangeRate();
    stakeAmount = underlyingAmount.rayDiv(exchangeRate);
    (uint256 toBalance, uint32 toCooldown) = internalBalanceAndCooldownOf(to);

    toCooldown = getNextCooldown(0, stakeAmount, toBalance, toCooldown);

    internalTransferUnderlyingFrom(from, underlyingAmount, index);

    super.doIncrementRewardBalance(to, stakeAmount);
    super.doIncrementTotalSupply(stakeAmount);
    super.internalSetRewardEntryCustom(to, toCooldown);

    emit Staked(from, to, underlyingAmount, referral);
    emit Transfer(address(0), to, stakeAmount);
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
    if (underlyingAmount == type(uint256).max) {
      (, underlyingAmount_) = internalRedeem(msg.sender, to, type(uint256).max, 0);
    } else {
      (, underlyingAmount_) = internalRedeem(msg.sender, to, 0, underlyingAmount);
    }
    return underlyingAmount_;
  }

  function internalRedeem(
    address from,
    address to,
    uint256 stakeAmount,
    uint256 underlyingAmount
  ) internal notPausedCustom(Errors.STK_PAUSED) returns (uint256, uint256) {
    require(!_notRedeemable, Errors.STK_REDEEM_PAUSED);
    _ensureCooldown(from);

    (uint256 exchangeRate, uint256 index) = internalExchangeRate();

    (uint256 oldBalance, uint32 cooldownFrom) = internalBalanceAndCooldownOf(from);
    if (stakeAmount == 0) {
      stakeAmount = underlyingAmount.rayDiv(exchangeRate);
    } else {
      if (stakeAmount == type(uint256).max) {
        stakeAmount = oldBalance;
      }
      underlyingAmount = stakeAmount.rayMul(exchangeRate);
      if (underlyingAmount == 0) {
        // protect the user - don't waste balance without an outcome
        return (0, 0);
      }
    }

    super.doDecrementRewardBalance(from, stakeAmount, 0);
    super.doDecrementTotalSupply(stakeAmount);
    if (oldBalance == stakeAmount && cooldownFrom != 0) {
      super.internalSetRewardEntryCustom(from, 0);
    }

    internalTransferUnderlyingTo(from, to, underlyingAmount, index);

    emit Redeemed(from, to, stakeAmount, underlyingAmount);
    emit Transfer(from, address(0), stakeAmount);
    return (stakeAmount, underlyingAmount);
  }

  function balanceOf(address account) public view virtual override returns (uint256) {
    return super.getRewardEntry(account).rewardBase;
  }

  function rewardedBalanceOf(address account) external view override returns (uint256) {
    return super.getRewardEntry(account).rewardBase;
  }

  function balanceOfUnderlying(address account) public view virtual override returns (uint256) {
    return uint256(super.getRewardEntry(account).rewardBase).rayMul(exchangeRate());
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

  function internalTransferUnderlyingFrom(
    address from,
    uint256 underlyingAmount,
    uint256 index
  ) internal virtual {
    index;
    _stakedToken.safeTransferFrom(from, address(this), underlyingAmount);
  }

  function internalTransferUnderlyingTo(
    address from,
    address to,
    uint256 underlyingAmount,
    uint256 index
  ) internal virtual {
    from;
    index;
    _stakedToken.safeTransfer(to, underlyingAmount);
  }

  function internalTransferSlashedUnderlying(address destination, uint256 amount)
    internal
    virtual
    override
    returns (bool erc20Transfer)
  {
    if (address(_strategy) == address(0)) {
      _stakedToken.safeTransfer(destination, amount);
    } else {
      amount = UnderlyingHelper.delegateWithdrawUnderlying(_strategy, address(_stakedToken), amount, destination);
    }
    return true;
  }

  function setCooldown(uint32 cooldownPeriod, uint32 unstakePeriod) external override onlyStakeAdminOrConfigurator {
    super.internalSetCooldown(cooldownPeriod, unstakePeriod);
  }

  function isRedeemable() external view override returns (bool) {
    return !(super.isPaused() || _notRedeemable);
  }

  function setRedeemable(bool redeemable) external override onlyLiquidityController {
    _notRedeemable = !redeemable;
    emit RedeemableUpdated(redeemable);
  }

  function getUnderlying() internal view returns (address) {
    return address(_stakedToken);
  }

  function transferBalance(
    address from,
    address to,
    uint256 amount
  ) internal virtual override {
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
}
