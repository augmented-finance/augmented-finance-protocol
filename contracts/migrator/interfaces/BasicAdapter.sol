// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;

import {IERC20} from '../../dependencies/openzeppelin/contracts/IERC20.sol';
import {SafeERC20} from '../../dependencies/openzeppelin/contracts/SafeERC20.sol';
import {SafeMath} from '../../dependencies/openzeppelin/contracts/SafeMath.sol';
import {Ownable} from '../../dependencies/openzeppelin/contracts/Ownable.sol';
import {Address} from '../../dependencies/openzeppelin/contracts/Address.sol';

import {IMigrationAdapter} from './IMigrationAdapter.sol';
import {ILendableToken, ILendablePool} from './ILendableToken.sol';
import {IRewardPool} from '../../reward/interfaces/IRewardPool.sol';

import 'hardhat/console.sol';

abstract contract BasicAdapter is IMigrationAdapter, Ownable {
  using SafeERC20 for IERC20;
  using SafeMath for uint256;

  address internal _originAsset;
  uint256 internal _totalDeposited;
  mapping(address => uint256) internal _deposits;

  IRewardPool internal _rewardPool;

  ILendableToken internal _targetAsset;
  uint256 internal _totalMigrated;

  address _controller;

  bool internal _paused;
  bool internal _claimAllowed;

  constructor(address originAsset) public {
    require(IERC20(originAsset).totalSupply() > 0, 'invalid origin');
    _originAsset = originAsset;
  }

  function ORIGIN_ASSET_ADDRESS() external view override returns (address) {
    return _originAsset;
  }

  function UNDERLYING_ASSET_ADDRESS() external view override returns (address) {
    return getUnderlying();
  }

  function REWARD_CONTROLLER_ADDRESS() external view returns (address) {
    return address(_rewardPool);
  }

  function depositToMigrate(
    uint256 amount,
    address holder,
    uint64 referralCode
  ) external override notMigrated notPaused returns (uint256) {
    require(holder != address(0), 'holder is required');
    referralCode;

    uint256 internalAmount = transferOriginIn(amount, holder);
    uint256 oldBalance = _deposits[holder];
    _deposits[holder] = oldBalance.add(internalAmount);
    _totalDeposited = _totalDeposited.add(internalAmount);

    if (address(_rewardPool) != address(0)) {
      _rewardPool.handleBalanceUpdate(holder, oldBalance, _deposits[holder], _totalDeposited);
    }
    return amount;
  }

  function withdrawFromMigrate(
    uint256 amount /* notMigrated */
  ) external override returns (uint256) {
    return privateWithdrawFromMigrate(amount, msg.sender);
  }

  function withdrawFromMigrateOnBehalf(uint256 amount, address holder)
    external
    override
    /* notMigrated */
    onlyController
    returns (uint256)
  {
    require(holder != address(0), 'holder is required');
    return privateWithdrawFromMigrate(amount, holder);
  }

  function balanceForMigrate(address holder) external view override returns (uint256) {
    return getOriginBalance(holder);
  }

  function isClaimable() external view override returns (bool) {
    return internalIsClaimable();
  }

  function claimMigrated(
    address holder /* claimable */
  ) external override returns (uint256) {
    return privateClaimPortion(holder, 1);
  }

  /// @dev claimMigratedPortion is a backup solution for large deposits
  function claimMigratedPortion(
    address holder,
    uint256 divisor /* claimable */
  ) external returns (uint256 amount) {
    return privateClaimPortion(holder, divisor);
  }

  function privateClaimPortion(address holder, uint256 divisor)
    private
    claimable
    returns (uint256 amount)
  {
    amount = _deposits[holder] / divisor;
    if (amount == 0) {
      return 0;
    }
    _deposits[holder] -= amount;

    amount = amount.mul(_totalMigrated).div(_totalDeposited);
    return transferTargetOut(amount, holder);
  }

  function admin_setRewardPool(IRewardPool rewardPool) external override ownerOrController {
    _rewardPool = rewardPool;
  }

  function admin_enableClaims() external override ownerOrController {
    _claimAllowed = true;
  }

  function admin_setPaused(bool paused) external override ownerOrController {
    _paused = paused;
  }

  function admin_setController(address controller) external override onlyOwner {
    require(Address.isContract(controller), 'controller should be a contract');
    _controller = controller;
  }

  function getController() external override returns (address) {
    return _controller;
  }

  function admin_migrateAll(ILendableToken targetAsset)
    external
    override
    onlyController
    notMigrated
  {
    address underlying = getUnderlying();
    require(targetAsset.UNDERLYING_ASSET_ADDRESS() == underlying, 'mismatched underlying');

    uint256 withdrawnAmount = withdrawUnderlyingFromOrigin(underlying);

    if (withdrawnAmount == 0) {
      require(_totalDeposited == 0, 'withdrawn zero when deposited non zero');
      _totalMigrated = 1;
      // make sure that "migrated" functions can't be invoked before it is done
      _targetAsset = targetAsset;
      return;
    }

    ILendablePool toPool = targetAsset.POOL();
    uint256 targetAmount = targetAsset.scaledBalanceOf(address(this));
    toPool.deposit(underlying, withdrawnAmount, address(this), 0);
    targetAmount = targetAsset.scaledBalanceOf(address(this)).sub(targetAmount);
    require(targetAmount > 0, 'deposited less than expected');
    _totalMigrated = targetAmount;

    // make sure that "migrated" functions can't be invoked before it is done
    _targetAsset = targetAsset;
  }

  /// @dev admin_sweepToken allows an owner to handle funds accidentially sent to this contract.
  /// For safety reasons:
  /// 1. target asset can never be swept as there can be unclaimed funds.
  /// 2. origin and underlying assets can only be swept after migration (residual amounts).
  function admin_sweepToken(address token) external onlyOwner returns (uint256) {
    require(token != address(0), 'unknown token');
    require(token != address(_targetAsset), 'target asset can not be swept');
    if (token == getUnderlying() || token == _originAsset) {
      require(internalIsMigrated(), 'origin and underlying can only be swept after migration');
    }
    uint256 amount = IERC20(token).balanceOf(address(this));
    if (amount > 0) {
      IERC20(token).safeTransfer(msg.sender, amount);
    }
    return amount;
  }

  function getUnderlying() internal view virtual returns (address);

  function transferOriginIn(uint256 amount, address holder)
    internal
    virtual
    returns (uint256 internalAmount);

  function transferOriginOut(uint256 amount, address holder)
    internal
    virtual
    returns (uint256 internalAmount);

  function transferTargetOut(uint256 internalAmount, address holder)
    internal
    virtual
    returns (uint256 userAmount);

  function withdrawUnderlyingFromOrigin(address underlying)
    internal
    virtual
    returns (uint256 amount);

  function getOriginBalance(address holder) internal view virtual returns (uint256 amount);

  function totalBalanceForMigrate() external view virtual returns (uint256);

  function getNormalizeTargetFactor() internal view returns (uint256) {
    return _targetAsset.POOL().getReserveNormalizedIncome(_targetAsset.UNDERLYING_ASSET_ADDRESS());
  }

  function privateWithdrawFromMigrate(uint256 amount, address holder)
    private
    notMigrated
    returns (uint256)
  {
    uint256 maxAmount = getOriginBalance(holder);
    if (maxAmount == 0) {
      return 0;
    }
    if (amount > maxAmount) {
      amount = maxAmount;
    }

    uint256 internalAmount = transferOriginOut(amount, holder);
    _totalDeposited = _totalDeposited.sub(internalAmount);

    if (amount == maxAmount) {
      delete (_deposits[holder]);
      if (address(_rewardPool) != address(0)) {
        _rewardPool.handleBalanceUpdate(holder, maxAmount, 0, _totalDeposited);
      }
      return amount;
    }

    uint256 oldBalance = _deposits[holder];
    _deposits[holder] = oldBalance.sub(internalAmount);
    if (address(_rewardPool) != address(0)) {
      _rewardPool.handleBalanceUpdate(holder, oldBalance, _deposits[holder], _totalDeposited);
    }
    return amount;
  }

  function internalIsClaimable() internal view returns (bool) {
    return internalIsMigrated() && _claimAllowed && !_paused;
  }

  function internalIsMigrated() internal view returns (bool) {
    return address(_targetAsset) != address(0);
  }

  modifier onlyController() {
    require(_controller == _msgSender(), 'caller is not the controller');
    _;
  }

  modifier ownerOrController() {
    require(
      owner() == _msgSender() || _controller == _msgSender(),
      'caller is not the owner or controller'
    );
    _;
  }

  modifier notMigrated() {
    require(address(_targetAsset) == address(0), 'migrating or migrated');
    _;
  }

  modifier migrated() {
    require(internalIsMigrated(), 'not migrated');
    _;
  }

  modifier claimable() {
    require(internalIsClaimable(), 'not claimable');
    _;
  }

  modifier notPaused() {
    require(!_paused, 'paused');
    _;
  }
}
