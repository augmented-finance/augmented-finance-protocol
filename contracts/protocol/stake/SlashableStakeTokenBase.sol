// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import '../../misc/ERC20WithPermit.sol';
import '../../dependencies/openzeppelin/contracts/IERC20.sol';
import './interfaces/IStakeToken.sol';
import './interfaces/IManagedStakeToken.sol';
import '../../dependencies/openzeppelin/contracts/SafeERC20.sol';
import '../../dependencies/openzeppelin/contracts/SafeMath.sol';
import '../../tools/math/WadRayMath.sol';
import '../../tools/math/PercentageMath.sol';
import '../../interfaces/IBalanceHook.sol';
import '../../access/AccessFlags.sol';
import '../../access/MarketAccessBitmask.sol';
import '../../access/interfaces/IMarketAccessController.sol';
import '../../tools/Errors.sol';
import './interfaces/StakeTokenConfig.sol';
import './interfaces/IInitializableStakeToken.sol';

abstract contract SlashableStakeTokenBase is
  IStakeToken,
  IManagedStakeToken,
  ERC20WithPermit,
  MarketAccessBitmask(IMarketAccessController(0)),
  IInitializableStakeToken
{
  using SafeMath for uint256;
  using WadRayMath for uint256;
  using PercentageMath for uint256;
  using SafeERC20 for IERC20;

  IERC20 private _stakedToken;
  IBalanceHook internal _incentivesController;

  mapping(address => uint32) private _stakersCooldowns;

  uint32 private _cooldownPeriod;
  uint32 private _unstakePeriod;
  uint16 private _maxSlashablePercentage;
  bool private _redeemPaused;

  constructor(
    StakeTokenConfig memory params,
    string memory name,
    string memory symbol,
    uint8 decimals
  ) public ERC20WithPermit(name, symbol, decimals) {
    _initializeToken(params);
  }

  function _initializeToken(StakeTokenConfig memory params) internal virtual {
    _remoteAcl = params.stakeController;
    _stakedToken = params.stakedToken;
    _cooldownPeriod = params.cooldownPeriod;

    if (params.unstakePeriod == 0) {
      _unstakePeriod = 10;
    } else {
      _unstakePeriod = params.unstakePeriod;
    }

    if (params.maxSlashable >= PercentageMath.ONE) {
      _maxSlashablePercentage = PercentageMath.ONE;
    } else {
      _maxSlashablePercentage = params.maxSlashable;
    }
  }

  function UNDERLYING_ASSET_ADDRESS() external view override returns (address) {
    return address(_stakedToken);
  }

  function stake(
    address to,
    uint256 underlyingAmount,
    uint256 referral
  ) external override returns (uint256) {
    internalStake(msg.sender, to, underlyingAmount, referral, true);
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

    _stakersCooldowns[to] = getNextCooldown(0, stakeAmount, to, oldReceiverBalance);

    if (transferFrom) {
      _stakedToken.safeTransferFrom(from, address(this), underlyingAmount);
    }
    _mint(to, stakeAmount);

    if (address(_incentivesController) != address(0)) {
      _incentivesController.handleBalanceUpdate(
        address(this),
        to,
        oldReceiverBalance,
        balanceOf(to),
        totalSupply()
      );
    }

    emit Staked(from, to, underlyingAmount, referral);
    return stakeAmount;
  }

  /**
   * @dev Redeems staked tokens, and stop earning rewards
   * @param to Address to redeem to
   * @param stakeAmount Amount of stake to redeem
   **/
  function redeem(address to, uint256 stakeAmount)
    external
    override
    returns (uint256 stakeAmount_)
  {
    require(stakeAmount > 0, Errors.VL_INVALID_AMOUNT);
    (stakeAmount_, ) = internalRedeem(msg.sender, to, stakeAmount, 0);
    return stakeAmount_;
  }

  /**
   * @dev Redeems staked tokens, and stop earning rewards
   * @param to Address to redeem to
   * @param underlyingAmount Amount of underlying to redeem
   **/
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

    uint256 cooldownStartAt = _stakersCooldowns[from];

    require(
      cooldownStartAt != 0 && block.timestamp > cooldownStartAt.add(_cooldownPeriod),
      Errors.STK_INSUFFICIENT_COOLDOWN
    );
    require(
      block.timestamp.sub(cooldownStartAt.add(_cooldownPeriod)) <= _unstakePeriod,
      Errors.STK_UNSTAKE_WINDOW_FINISHED
    );

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
      _incentivesController.handleBalanceUpdate(
        address(this),
        from,
        oldBalance,
        balanceOf(from),
        totalSupply()
      );
    }

    IERC20(_stakedToken).safeTransfer(to, underlyingAmount);

    emit Redeemed(from, to, stakeAmount, underlyingAmount);
    return (stakeAmount, underlyingAmount);
  }

  /// @dev Activates the cooldown period to unstake. Reverts if the user has no stake.
  function cooldown() external override {
    require(balanceOf(msg.sender) != 0, Errors.STK_INVALID_BALANCE_ON_COOLDOWN);

    // console.log('cooldown: ', msg.sender, address(this));
    // console.log('block.timestamp: ', block.timestamp);

    _stakersCooldowns[msg.sender] = uint32(block.timestamp);
    emit CooldownStarted(msg.sender, uint32(block.timestamp));
  }

  /// @dev Returns the end of the current cooldown period or zero for a user without a stake.
  function getCooldown(address holder) external view override returns (uint32) {
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
      windowEnd = windowStart + _unstakePeriod;
      if (windowEnd < windowStart) {
        windowEnd = type(uint32).max;
      }
    }
    return (balanceOf(holder), windowStart, windowEnd);
  }

  function exchangeRate() public view override returns (uint256) {
    uint256 total = super.totalSupply();
    if (total == 0) {
      return WadRayMath.RAY; // 100%
    }
    uint256 underlyingBalance = _stakedToken.balanceOf(address(this));
    if (underlyingBalance >= total) {
      return WadRayMath.RAY; // 100%
    }

    return underlyingBalance.rayBase(total);
  }

  function slashUnderlying(
    address destination,
    uint256 minAmount,
    uint256 maxAmount
  ) external override aclHas(AccessFlags.LIQUIDITY_CONTROLLER) returns (uint256 amount) {
    uint256 underlyingBalance = _stakedToken.balanceOf(address(this));
    uint256 maxSlashable = super.totalSupply();

    if (underlyingBalance > maxSlashable) {
      maxSlashable =
        underlyingBalance -
        maxSlashable +
        maxSlashable.percentMul(_maxSlashablePercentage);
    } else {
      maxSlashable = underlyingBalance.percentMul(_maxSlashablePercentage);
    }

    if (maxAmount > maxSlashable) {
      amount = maxSlashable;
    } else {
      amount = maxAmount;
    }
    if (amount < minAmount) {
      return 0;
    }
    _stakedToken.safeTransfer(destination, amount);

    emit Slashed(destination, amount, underlyingBalance);
    return amount;
  }

  function getMaxSlashablePercentage() external view override returns (uint16) {
    return _maxSlashablePercentage;
  }

  function setMaxSlashablePercentage(uint16 slashPct)
    external
    override
    aclHas(AccessFlags.STAKE_ADMIN)
  {
    require(slashPct <= PercentageMath.HALF_ONE, Errors.STK_EXCESSIVE_SLASH_PCT);
    _maxSlashablePercentage = slashPct;
    emit MaxSlashUpdated(slashPct);
  }

  function setCooldown(uint32 cooldownPeriod, uint32 unstakePeriod)
    external
    override
    aclHas(AccessFlags.STAKE_ADMIN)
  {
    require(cooldownPeriod <= 52 weeks, Errors.STK_EXCESSIVE_COOLDOWN_PERIOD);
    require(unstakePeriod >= 1 hours && unstakePeriod <= 52 weeks, Errors.STK_WRONG_UNSTAKE_PERIOD);
    _cooldownPeriod = cooldownPeriod;
    _unstakePeriod = unstakePeriod;
    emit CooldownUpdated(cooldownPeriod, unstakePeriod);
  }

  function isRedeemable() external view override returns (bool) {
    return !_redeemPaused;
  }

  function setRedeemable(bool redeemable)
    external
    override
    aclHas(AccessFlags.LIQUIDITY_CONTROLLER)
  {
    _redeemPaused = !redeemable;
    emit RedeemUpdated(redeemable);
  }

  function setPaused(bool paused) external override onlyEmergencyAdmin {
    _redeemPaused = paused;
    emit RedeemUpdated(!paused);
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
      _stakersCooldowns[to] = getNextCooldown(previousSenderCooldown, amount, to, balanceOfTo);

      // if cooldown was set and whole balance of sender was transferred - clear cooldown
      if (balanceOfFrom == amount && previousSenderCooldown != 0) {
        delete (_stakersCooldowns[from]);
      }
    }

    super._transfer(from, to, amount);
  }

  /**
   * @dev Calculates the how is gonna be a new cooldown time depending on the sender/receiver situation
   *  - If the time of the sender is "better" or the time of the recipient is 0, we take the one of the recipient
   *  - Weighted average of from/to cooldown time if:
   *    # The sender doesn't have the cooldown activated (time 0).
   *    # The sender time is passed
   *    # The sender has a "worse" time
   *  - If the receiver's cooldown time passed (too old), the next is 0
   * @param fromCooldownPeriod Cooldown time of the sender
   * @param amountToReceive Amount
   * @param toAddress Address of the recipient
   * @param toBalance Current balance of the receiver
   * @return The new cooldown time
   **/
  function getNextCooldown(
    uint32 fromCooldownPeriod,
    uint256 amountToReceive,
    address toAddress,
    uint256 toBalance
  ) internal returns (uint32) {
    uint32 toCooldownPeriod = _stakersCooldowns[toAddress];
    if (toCooldownPeriod == 0) {
      return 0;
    }

    uint256 minimalValidCooldown = block.timestamp.sub(_cooldownPeriod).sub(_unstakePeriod);

    if (minimalValidCooldown > toCooldownPeriod) {
      toCooldownPeriod = 0;
    } else {
      if (minimalValidCooldown > fromCooldownPeriod) {
        fromCooldownPeriod = uint32(block.timestamp);
      }

      if (fromCooldownPeriod < toCooldownPeriod) {
        return toCooldownPeriod;
      } else {
        toCooldownPeriod = uint32(
          (amountToReceive.mul(fromCooldownPeriod).add(toBalance.mul(toCooldownPeriod))).div(
            amountToReceive.add(toBalance)
          )
        );
      }
    }
    _stakersCooldowns[toAddress] = toCooldownPeriod;

    return toCooldownPeriod;
  }

  function COOLDOWN_PERIOD() external view returns (uint256) {
    return _cooldownPeriod;
  }

  /// @notice Seconds available to redeem once the cooldown period is fullfilled
  function UNSTAKE_PERIOD() external view returns (uint256) {
    return _unstakePeriod;
  }

  function initializedWith()
    external
    view
    override
    returns (
      StakeTokenConfig memory params,
      string memory name_,
      string memory symbol_,
      uint8 decimals_
    )
  {
    params.stakeController = _remoteAcl;
    params.stakedToken = _stakedToken;
    params.cooldownPeriod = _cooldownPeriod;
    params.unstakePeriod = _unstakePeriod;
    params.maxSlashable = _maxSlashablePercentage;
    return (params, name(), symbol(), decimals());
  }

  function setIncentivesController(address addr) external override onlyRewardConfiguratorOrAdmin {
    _incentivesController = IBalanceHook(addr);
  }

  function getIncentivesController() public view override returns (address) {
    return address(_incentivesController);
  }
}
