// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../../../dependencies/openzeppelin/contracts/SafeERC20.sol';
import '../../../interfaces/IDepositToken.sol';
import '../../../tools/Errors.sol';
import '../../../tools/math/WadRayMath.sol';
import '../../../tools/math/PercentageMath.sol';
import '../../../tools/tokens/ERC20Events.sol';
import '../../../access/AccessFlags.sol';
import '../../../tools/tokens/ERC20PermitBase.sol';
import '../../../tools/tokens/ERC20AllowanceBase.sol';
import './SubBalanceBase.sol';

/// @dev Implementation of the interest bearing token for the Augmented Finance protocol
abstract contract DepositTokenBase is SubBalanceBase, ERC20PermitBase, ERC20AllowanceBase {
  using WadRayMath for uint256;
  using PercentageMath for uint256;
  using SafeERC20 for IERC20;
  using AccessHelper for IMarketAccessController;

  address internal _treasury;

  constructor(address treasury_) {
    _treasury = treasury_;
  }

  function _initializePoolToken(PoolTokenConfig memory config, bytes calldata params) internal virtual override {
    require(config.treasury != address(0), Errors.VL_TREASURY_REQUIRED);
    super._initializeDomainSeparator();
    super._initializePoolToken(config, params);
    internalSetOverdraftTolerancePct(PercentageMath.HALF_ONE);
    _treasury = config.treasury;
  }

  function getTreasury() external view returns (address) {
    return _treasury;
  }

  function updateTreasury() external override onlyLendingPoolConfiguratorOrAdmin {
    address treasury = _remoteAcl.getAddress(AccessFlags.TREASURY);
    require(treasury != address(0), Errors.VL_TREASURY_REQUIRED);
    _treasury = treasury;
  }

  function setOverdraftTolerancePct(uint16 overdraftTolerancePct) external onlyLendingPoolConfiguratorOrAdmin {
    internalSetOverdraftTolerancePct(overdraftTolerancePct);
  }

  function addSubBalanceOperator(address addr) external override onlyLendingPoolConfiguratorOrAdmin {
    _addSubBalanceOperator(addr, ACCESS_SUB_BALANCE);
  }

  function addStakeOperator(address addr) external override {
    _remoteAcl.requireAnyOf(
      msg.sender,
      AccessFlags.POOL_ADMIN |
        AccessFlags.LENDING_POOL_CONFIGURATOR |
        AccessFlags.STAKE_CONFIGURATOR |
        AccessFlags.STAKE_ADMIN,
      Errors.CALLER_NOT_POOL_ADMIN
    );

    _addSubBalanceOperator(addr, ACCESS_LOCK_BALANCE | ACCESS_TRANSFER);
  }

  function removeSubBalanceOperator(address addr) external override onlyLendingPoolConfiguratorOrAdmin {
    _removeSubBalanceOperator(addr);
  }

  function getSubBalanceOperatorAccess(address addr) internal view override returns (uint8) {
    if (addr == address(_pool)) {
      return ~uint8(0);
    }
    return super.getSubBalanceOperatorAccess(addr);
  }

  function getScaleIndex() public view override returns (uint256) {
    return _pool.getReserveNormalizedIncome(_underlyingAsset);
  }

  function mint(
    address user,
    uint256 amount,
    uint256 index,
    bool repayOverdraft
  ) external override onlyLendingPool returns (bool firstBalance) {
    uint256 amountScaled = amount.rayDiv(index);
    require(amountScaled != 0, Errors.CT_INVALID_MINT_AMOUNT);

    firstBalance = _mintToSubBalance(user, amountScaled, repayOverdraft);

    _mintBalance(user, amountScaled, index);
    emit Transfer(address(0), user, amount);
    emit Mint(user, amount, index);

    return firstBalance;
  }

  function mintToTreasury(uint256 amount, uint256 index) external override onlyLendingPool {
    if (amount == 0) {
      return;
    }

    address treasury = _treasury;

    // Compared to the normal mint, we don't check for rounding errors.
    // The treasury may experience a very small loss, but it wont revert a valid transactions.
    _mintBalance(treasury, amount.rayDiv(index), index);

    emit Transfer(address(0), treasury, amount);
    emit Mint(treasury, amount, index);
  }

  function burn(
    address user,
    address receiverOfUnderlying,
    uint256 amount,
    uint256 index
  ) external override onlyLendingPool {
    uint256 amountScaled = amount.rayDiv(index);
    require(amountScaled != 0, Errors.CT_INVALID_BURN_AMOUNT);
    _burnBalance(user, amountScaled, getMinBalance(user), index);

    IERC20(_underlyingAsset).safeTransfer(receiverOfUnderlying, amount);

    emit Transfer(user, address(0), amount);
    emit Burn(user, receiverOfUnderlying, amount, index);
  }

  function transferOnLiquidation(
    address user,
    address receiver,
    uint256 amount,
    uint256 index,
    bool transferUnderlying
  ) external override onlyLendingPool returns (bool) {
    uint256 scaledAmount = amount.rayDiv(index);
    if (scaledAmount == 0) {
      return false;
    }

    (bool firstBalance, uint256 outBalance) = _liquidateWithSubBalance(
      user,
      receiver,
      scaledAmount,
      index,
      transferUnderlying
    );

    if (transferUnderlying) {
      // Burn the equivalent amount of tokens, sending the underlying to the liquidator
      _burnBalance(user, scaledAmount, outBalance, index);
      IERC20(_underlyingAsset).safeTransfer(receiver, amount);

      emit Transfer(user, address(0), amount);
      emit Burn(user, receiver, amount, index);
      return false;
    }

    super._transferBalance(user, receiver, scaledAmount, outBalance, index);

    emit Transfer(user, receiver, amount);
    emit BalanceTransfer(user, receiver, amount, index);
    return firstBalance;
  }

  /// @dev Calculates the balance of the user: principal balance + interest generated by the principal
  function balanceOf(address user) public view override returns (uint256) {
    uint256 scaledBalance = scaledBalanceOf(user);
    if (scaledBalance == 0) {
      return 0;
    }
    return scaledBalanceOf(user).rayMul(getScaleIndex());
  }

  function rewardedBalanceOf(address user) external view override returns (uint256) {
    return internalBalanceOf(user).rayMul(getScaleIndex());
  }

  function getScaledUserBalanceAndSupply(address user) external view override returns (uint256, uint256) {
    return (scaledBalanceOf(user), scaledTotalSupply());
  }

  function totalSupply() public view override returns (uint256) {
    uint256 currentSupplyScaled = scaledTotalSupply();
    if (currentSupplyScaled == 0) {
      return 0;
    }
    return currentSupplyScaled.rayMul(getScaleIndex());
  }

  function transfer(address recipient, uint256 amount) public virtual override returns (bool) {
    _transfer(msg.sender, recipient, amount, getScaleIndex());
    return true;
  }

  function transferFrom(
    address sender,
    address recipient,
    uint256 amount
  ) public virtual override returns (bool) {
    _transfer(sender, recipient, amount, getScaleIndex());
    _approveTransferFrom(sender, amount);
    return true;
  }

  function transferUnderlyingTo(address target, uint256 amount) external override onlyLendingPool returns (uint256) {
    IERC20(_underlyingAsset).safeTransfer(target, amount);
    return amount;
  }

  /**
   * @dev Validates and executes a transfer.
   * @param from The source address
   * @param to The destination address
   * @param amount The amount getting transferred
   **/
  function _transfer(
    address from,
    address to,
    uint256 amount,
    uint256 index
  ) private {
    uint256 scaledAmount = amount.rayDiv(index);
    (uint256 scaledBalanceBeforeFrom, uint256 flags) = internalBalanceAndFlagsOf(from);

    _transferAndFinalize(from, to, scaledAmount, getMinBalance(from, flags), index, scaledBalanceBeforeFrom);

    emit Transfer(from, to, amount);
    emit BalanceTransfer(from, to, amount, index);
  }

  function _transferScaled(
    address from,
    address to,
    uint256 scaledAmount,
    uint256 minBalance,
    uint256 index
  ) internal override {
    _transferAndFinalize(from, to, scaledAmount, minBalance, index, internalBalanceOf(from));

    uint256 amount = scaledAmount.rayMul(index);
    emit Transfer(from, to, amount);
    emit BalanceTransfer(from, to, amount, index);
  }

  function _transferAndFinalize(
    address from,
    address to,
    uint256 scaledAmount,
    uint256 minBalance,
    uint256 index,
    uint256 scaledBalanceBeforeFrom
  ) private {
    uint256 scaledBalanceBeforeTo = internalBalanceOf(to);
    super._transferBalance(from, to, scaledAmount, minBalance, index);

    _pool.finalizeTransfer(
      _underlyingAsset,
      from,
      to,
      scaledAmount > 0 && scaledBalanceBeforeFrom == scaledAmount,
      scaledAmount > 0 && scaledBalanceBeforeTo == 0
    );
  }

  function _ensureHealthFactor(address holder) internal override {
    _pool.finalizeTransfer(_underlyingAsset, holder, holder, false, false);
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

  function internalPause(bool paused) internal override {
    super.internalPause(paused);
    _pool.setReservePaused(_underlyingAsset, paused);
  }
}
