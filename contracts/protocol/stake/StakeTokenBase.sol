// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {ERC20WithPermit} from '../../misc/ERC20WithPermit.sol';

import {IERC20} from '../../dependencies/openzeppelin/contracts/IERC20.sol';
import {IManagedStakeToken} from './interfaces/IStakeToken.sol';

import {SafeERC20} from '../../dependencies/openzeppelin/contracts/SafeERC20.sol';
import {SafeMath} from '../../dependencies/openzeppelin/contracts/SafeMath.sol';
import {PercentageMath} from '../../tools/math/PercentageMath.sol';

import {IBalanceHook} from '../../interfaces/IBalanceHook.sol';

// import {AccessFlags} from '../../access/AccessFlags.sol';
import {RemoteAccessBitmask} from '../../access/RemoteAccessBitmask.sol';
import {IMarketAccessController} from '../../access/interfaces/IMarketAccessController.sol';

import {Errors} from '../../tools/Errors.sol';
import {StakeTokenConfig} from './interfaces/StakeTokenConfig.sol';
import {IInitializableStakeToken} from './interfaces/IInitializableStakeToken.sol';

abstract contract StakeTokenBase is
  IManagedStakeToken,
  ERC20WithPermit,
  RemoteAccessBitmask,
  IInitializableStakeToken
{
  using SafeMath for uint256;
  using PercentageMath for uint256;
  using SafeERC20 for IERC20;

  IERC20 private _stakedToken;
  IBalanceHook internal _incentivesController;

  mapping(address => uint32) private _stakersCooldowns;

  uint256 private _maxSlashablePercentage;
  uint32 private _cooldownBlocks;
  uint32 private _unstakeBlocks;
  bool private _redeemPaused;

  event Staked(address from, address to, uint256 amount);
  event Redeem(address from, address to, uint256 amount, uint256 underlyingAmount);
  event Cooldown(address user, uint32 blockNumber);
  event Donated(address from, uint256 amount);
  event Slashed(address to, uint256 amount);

  constructor(
    StakeTokenConfig memory params,
    string memory name,
    string memory symbol,
    uint8 decimals
  ) public ERC20WithPermit(name, symbol, decimals) RemoteAccessBitmask(params.stakeController) {
    _initializeToken(params);
  }

  function _initializeToken(StakeTokenConfig memory params) internal virtual {
    _remoteAcl = params.stakeController;
    _stakedToken = params.stakedToken;
    _cooldownBlocks = params.cooldownBlocks;
    if (params.unstakeBlocks == 0) {
      _unstakeBlocks = 10;
    } else {
      _unstakeBlocks = params.unstakeBlocks;
    }

    if (_maxSlashablePercentage == 0) {
      _maxSlashablePercentage = 30 * PercentageMath.PCT;
    }
  }

  function internalStakeController() internal view returns (IMarketAccessController) {
    return IMarketAccessController(address(_remoteAcl));
  }

  function UNDERLYING_ASSET_ADDRESS() external view override returns (address) {
    return address(_stakedToken);
  }

  function stake(address to, uint256 underlyingAmount) external override returns (uint256) {
    internalStake(msg.sender, to, underlyingAmount, true);
  }

  function internalStake(
    address from,
    address to,
    uint256 underlyingAmount,
    bool transferFrom
  ) internal returns (uint256 stakeAmount) {
    require(underlyingAmount > 0, Errors.VL_INVALID_AMOUNT);
    uint256 oldReceiverBalance = balanceOf(to);
    stakeAmount = underlyingAmount.percentDiv(exchangeRate());

    _stakersCooldowns[to] = getNextCooldownBlocks(0, stakeAmount, to, oldReceiverBalance);

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

    emit Staked(from, to, underlyingAmount);
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
    require(!_redeemPaused, 'STK_REDEEM_PAUSED');

    uint256 cooldownStartBlock = _stakersCooldowns[from];
    require(block.number > cooldownStartBlock.add(_cooldownBlocks), 'STK_INSUFFICIENT_COOLDOWN');
    require(
      block.number.sub(cooldownStartBlock.add(_cooldownBlocks)) <= _unstakeBlocks,
      'STK_UNSTAKE_WINDOW_FINISHED'
    );

    uint256 oldBalance = balanceOf(from);
    if (stakeAmount == 0) {
      stakeAmount = stakeAmount.percentDiv(exchangeRate());

      if (stakeAmount > oldBalance) {
        stakeAmount = oldBalance;
        underlyingAmount = stakeAmount.percentMul(exchangeRate());
      }
    } else {
      if (stakeAmount > oldBalance) {
        stakeAmount = oldBalance;
      }
      underlyingAmount = stakeAmount.percentMul(exchangeRate());
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

    emit Redeem(from, to, stakeAmount, underlyingAmount);
    return (stakeAmount, underlyingAmount);
  }

  /**
   * @dev Activates the cooldown period to unstake
   * - It can't be called if the user is not staking
   **/
  function cooldown() external override {
    require(balanceOf(msg.sender) != 0, 'STK_INVALID_BALANCE_ON_COOLDOWN');

    _stakersCooldowns[msg.sender] = uint32(block.number);
    emit Cooldown(msg.sender, uint32(block.number));
  }

  /**
   * @dev Gets end of the cooldown period.
   * - Returns zero for a not staking user.
   **/
  function getCooldown(address holder) external override returns (uint32) {
    return _stakersCooldowns[holder];
  }

  function exchangeRate() public view override returns (uint256) {
    uint256 total = totalSupply();
    if (total == 0) {
      return PercentageMath.ONE; // 100%
    }
    return _stakedToken.balanceOf(address(this)).percentOf(total);
  }

  function slashUnderlying(
    address destination,
    uint256 minAmount,
    uint256 maxAmount
  ) external override onlyLiquidityController returns (uint256 amount) {
    uint256 balance = _stakedToken.balanceOf(address(this));
    uint256 maxSlashable = balance.percentMul(_maxSlashablePercentage);

    if (maxAmount > maxSlashable) {
      amount = maxSlashable;
    } else {
      amount = maxAmount;
    }
    if (amount < minAmount) {
      return 0;
    }

    _stakedToken.safeTransfer(destination, amount);

    emit Slashed(destination, amount);
    return amount;
  }

  function donate(uint256 amount) external {
    _stakedToken.safeTransferFrom(msg.sender, address(this), amount);
    emit Donated(msg.sender, amount);
  }

  function getMaxSlashablePercentage() external view override returns (uint256) {
    return _maxSlashablePercentage;
  }

  function setMaxSlashablePercentage(uint256 percentageInRay) external override onlyAdmin {
    require(percentageInRay <= PercentageMath.ONE, 'STK_EXCESSIVE_SLASH_PCT');
    _maxSlashablePercentage = percentageInRay;
  }

  function isRedeemable() external view override returns (bool) {
    return !_redeemPaused;
  }

  function setRedeemable(bool redeemable) external override onlyLiquidityController {
    _redeemPaused = !redeemable;
  }

  function getUnderlying() internal view returns (address) {
    return address(_stakedToken);
  }

  /**
   * @dev Internal ERC20 _transfer of the tokenized staked tokens
   * @param from Address to transfer from
   * @param to Address to transfer to
   * @param amount Amount to transfer
   **/
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
      _stakersCooldowns[to] = getNextCooldownBlocks(
        previousSenderCooldown,
        amount,
        to,
        balanceOfTo
      );

      // if cooldown was set and whole balance of sender was transferred - clear cooldown
      if (balanceOfFrom == amount && previousSenderCooldown != 0) {
        delete (_stakersCooldowns[from]);
      }
    }

    super._transfer(from, to, amount);
  }

  /**
   * @dev Calculates the how is gonna be a new cooldown block depending on the sender/receiver situation
   *  - If the block of the sender is "better" or the block of the recipient is 0, we take the one of the recipient
   *  - Weighted average of from/to cooldown blocks if:
   *    # The sender doesn't have the cooldown activated (block 0).
   *    # The sender block is passed
   *    # The sender has a "worse" block
   *  - If the receiver's cooldown block passed (too old), the next is 0
   * @param fromCooldownBlock Cooldown block of the sender
   * @param amountToReceive Amount
   * @param toAddress Address of the recipient
   * @param toBalance Current balance of the receiver
   * @return The new cooldown block
   **/
  function getNextCooldownBlocks(
    uint32 fromCooldownBlock,
    uint256 amountToReceive,
    address toAddress,
    uint256 toBalance
  ) public returns (uint32) {
    uint32 toCooldownBlock = _stakersCooldowns[toAddress];
    if (toCooldownBlock == 0) {
      return 0;
    }

    uint256 minimalValidCooldownBlock = block.number.sub(_cooldownBlocks).sub(_unstakeBlocks);

    if (minimalValidCooldownBlock > toCooldownBlock) {
      toCooldownBlock = 0;
    } else {
      if (minimalValidCooldownBlock > fromCooldownBlock) {
        fromCooldownBlock = uint32(block.number);
      }

      if (fromCooldownBlock < toCooldownBlock) {
        return toCooldownBlock;
      } else {
        toCooldownBlock = uint32(
          (amountToReceive.mul(fromCooldownBlock).add(toBalance.mul(toCooldownBlock))).div(
            amountToReceive.add(toBalance)
          )
        );
      }
    }
    _stakersCooldowns[toAddress] = toCooldownBlock;

    return toCooldownBlock;
  }

  function COOLDOWN_BLOCKS() external view returns (uint256) {
    return _cooldownBlocks;
  }

  /// @notice Seconds available to redeem once the cooldown period is fullfilled
  function UNSTAKE_WINDOW_BLOCKS() external view returns (uint256) {
    return _unstakeBlocks;
  }

  modifier onlyAdmin() {
    require(internalStakeController().isStakeAdmin(msg.sender), 'admin access only');
    _;
  }

  modifier onlyLiquidityController() {
    require(
      internalStakeController().isLiquidityController(msg.sender),
      'LiquidityController only'
    );
    _;
  }
}
