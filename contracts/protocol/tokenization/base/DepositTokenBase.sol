// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../../../dependencies/openzeppelin/contracts/SafeERC20.sol';
import '../../../interfaces/IDepositToken.sol';
import '../../../tools/Errors.sol';
import '../../../tools/math/WadRayMath.sol';
import '../../../tools/tokens/ERC20Events.sol';
import '../../../access/AccessFlags.sol';
import '../../../tools/tokens/ERC20PermitBase.sol';
import '../../../tools/tokens/ERC20AllowanceBase.sol';
import './PoolTokenWithRewardsBase.sol';

/// @dev Implementation of the interest bearing token for the Augmented Finance protocol
abstract contract DepositTokenBase is IDepositToken, PoolTokenWithRewardsBase, ERC20PermitBase, ERC20AllowanceBase {
  using WadRayMath for uint256;
  using SafeERC20 for IERC20;

  address internal _treasury;

  // struct SubBalances {
  //   uint128 inBalance;
  //   uint128 outBalance;
  // }
  // mapping(address => SubBalances) private _subBalances;
  // mapping(address => bool) private _subBalanceOperators;
  // mapping(address => SubBalances) private _lostBalances;
  // uint256 private totalLostBalance;

  constructor(address treasury_) {
    _treasury = treasury_;
  }

  function _initializePoolToken(PoolTokenConfig memory config, bytes calldata params) internal virtual override {
    require(config.treasury != address(0), Errors.VL_TREASURY_REQUIRED);
    super._initializeDomainSeparator();
    super._initializePoolToken(config, params);
    _treasury = config.treasury;
  }

  function getTreasury() external view returns (address) {
    return _treasury;
  }

  function updateTreasury() external onlyLendingPoolConfiguratorOrAdmin {
    address treasury = _pool.getAccessController().getAddress(AccessFlags.TREASURY);
    require(treasury != address(0), Errors.VL_TREASURY_REQUIRED);
    _treasury = treasury;
  }

  // function addSubBalanceOperator(address addr) external onlyLendingPoolConfiguratorOrAdmin {
  //   require(addr != address(0));
  //   _subBalanceOperators[addr] = true;
  // }

  // function removeSubBalanceOperator(address addr) external onlyLendingPoolConfiguratorOrAdmin {
  //   delete(_subBalanceOperators[addr]);
  // }

  // function isSubBalanceOperator(address addr) private view returns (bool) {
  //   return addr == address(_pool) || _subBalanceOperators[addr];
  // }

  // modifier onlySubBalanceOperator() {
  //   require(isSubBalanceOperator(msg.sender), 'not a SubBalanceProvider');
  //   _;
  // }

  // function provideSubBalance(
  //   address from,
  //   address to,
  //   uint256 amount
  // ) external onlySubBalanceOperator {
  //   require(from != address(0) && from != to);

  //   {
  //     uint256 outBalance = amount + _subBalances[from].outBalance;
  //     require(outBalance <= super.balanceOf(from), 'insufficient balance');
  //     require(outBalance <= type(uint128).max);
  //     _subBalances[from].outBalance = uint128(outBalance);
  //   }

  //   if (to != address(0)) {
  //     amount += _subBalances[to].inBalance;
  //     require(amount <= type(uint128).max);
  //     _subBalances[to].inBalance = uint128(amount);
  //   }
  // }

  // function returnSubBalance(
  //   address from,
  //   address to,
  //   uint256 amount
  // ) external onlySubBalanceOperator {
  //   require(from != address(0) && from != to);

  //   if (from != address(0)) {
  //     _subBalances[from].inBalance = uint128(uint256(_subBalances[from].inBalance) - amount);
  //   }

  //   _subBalances[to].outBalance = uint128(uint256(_subBalances[to].outBalance) - amount);
  // }

  function mint(
    address user,
    uint256 amount,
    uint256 index,
    bool // repayOverdraft
  ) external override onlyLendingPool returns (bool) {
    bool firstBalance = super.balanceOf(user) == 0;

    uint256 amountScaled = amount.rayDiv(index);
    require(amountScaled != 0, Errors.CT_INVALID_MINT_AMOUNT);
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
    _burnBalance(
      user,
      amountScaled,
      0, /* _subBalances[user].outBalance */
      index
    );

    IERC20(_underlyingAsset).safeTransfer(receiverOfUnderlying, amount);

    emit Transfer(user, address(0), amount);
    emit Burn(user, receiverOfUnderlying, amount, index);
  }

  function transferOnLiquidation(
    address from,
    address to,
    uint256 amount,
    uint256 index,
    bool transferUnderlying
  ) external override onlyLendingPool returns (bool firstBalance) {
    uint256 scaledAmount = amount.rayDiv(index);
    if (scaledAmount == 0) {
      return false;
    }

    if (transferUnderlying) {
      // Burn the equivalent amount of depositToken, sending the underlying to the liquidator
      _burnBalance(
        from,
        scaledAmount,
        0, /* _subBalances[user].outBalance */
        index
      );
      IERC20(_underlyingAsset).safeTransfer(to, amount);

      emit Transfer(from, address(0), amount);
      emit Burn(from, to, amount, index);
      return false;
    }

    firstBalance = super.balanceOf(to) == 0;
    super._transferBalance(from, to, scaledAmount, 0, index);

    // SubBalances memory subBalances = _subBalances[from];
    // uint256 scaledBalanceFrom;

    // if (subBalances.inBalance == 0) {
    //   super._transferBalance(from, to, scaledAmount, subBalances.outBalance, index);
    // } else if (scaledAmount + subBalances.outBalance <= (scaledBalanceFrom = super.balanceOf(from))) {
    //   super._transferBalance(from, to, scaledAmount, subBalances.outBalance, index);
    // } else {
    //   unchecked {
    //     uint256 availableAmount = scaledBalanceFrom - subBalances.outBalance;
    //     scaledAmount -= availableAmount;
    //     super._transferBalance(from, to, availableAmount, subBalances.outBalance, index);
    //   }
    //   subBalances.inBalance = uint128(uint256(subBalances.inBalance) - scaledAmount);
    //   _subBalances[from] = subBalances;
    //   _lostBalances[from].inBalance += uint128(scaledAmount);
    //   totalLostBalance += scaledAmount;

    //   _mintBalance(to, scaledAmount, index);
    // }

    emit BalanceTransfer(from, to, amount, index);
    emit Transfer(from, to, amount);
    return firstBalance;
  }

  /// @dev Calculates the balance of the user: principal balance + interest generated by the principal
  function balanceOf(address user) public view override(IERC20, RewardedTokenBase) returns (uint256) {
    uint256 scaledBalance = scaledBalanceOf(user);
    if (scaledBalance == 0) {
      return 0;
    }
    return scaledBalanceOf(user).rayMul(_pool.getReserveNormalizedIncome(_underlyingAsset));
  }

  function scaledBalanceOf(address user) public view override returns (uint256) {
    return super.balanceOf(user);
    // uint256 userBalance = super.balanceOf(user);
    // if (userBalance == 0) {
    //   return 0;
    // }
    // return userBalance - _subBalances[user].outBalance;
  }

  function scaledRewardedBalanceOf(address user) external view override returns (uint256) {
    return super.balanceOf(user);
  }

  function collateralBalanceOf(address user) public view override returns (uint256 userBalance) {
    // SubBalances memory subBalances = _subBalances[user];
    // userBalance = super.balanceOf(user) - subBalances.outBalance;
    // userBalance += subBalances.inBalance;
    userBalance = super.balanceOf(user);
    return userBalance.rayMul(_pool.getReserveNormalizedIncome(_underlyingAsset));
  }

  function getScaledUserBalanceAndSupply(address user) external view override returns (uint256, uint256) {
    return (scaledBalanceOf(user), super.totalSupply());
  }

  function totalSupply() public view override(IERC20, PoolTokenBase) returns (uint256) {
    uint256 currentSupplyScaled = super.totalSupply();
    if (currentSupplyScaled == 0) {
      return 0;
    }

    return currentSupplyScaled.rayMul(_pool.getReserveNormalizedIncome(_underlyingAsset));
  }

  function scaledTotalSupply() public view virtual override returns (uint256) {
    return super.totalSupply();
  }

  function transfer(address recipient, uint256 amount) public virtual override returns (bool) {
    _transfer(msg.sender, recipient, amount);
    emit Transfer(msg.sender, recipient, amount);
    return true;
  }

  function transferFrom(
    address sender,
    address recipient,
    uint256 amount
  ) public virtual override returns (bool) {
    _transfer(sender, recipient, amount);
    _approveTransferFrom(sender, amount);
    emit Transfer(sender, recipient, amount);
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
    uint256 amount
  ) private {
    address underlyingAsset = _underlyingAsset;
    uint256 index = _pool.getReserveNormalizedIncome(underlyingAsset);
    uint256 scaledAmount = amount.rayDiv(index);

    // SubBalances memory subBalances = _subBalances[from];

    uint256 scaledBalanceBeforeFrom = super.balanceOf(from);
    uint256 scaledBalanceBeforeTo = super.balanceOf(to);

    super._transferBalance(from, to, scaledAmount, 0, index);

    _pool.finalizeTransfer(
      underlyingAsset,
      from,
      to,
      amount,
      scaledBalanceBeforeFrom.rayMul(index),
      scaledBalanceBeforeTo.rayMul(index)
    );

    emit BalanceTransfer(from, to, amount, index);
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
}
