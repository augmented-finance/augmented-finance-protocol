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
import './RewardedTokenBase.sol';

/// @dev Implementation of the interest bearing token for the Augmented Finance protocol
abstract contract DepositTokenBase is IDepositToken, RewardedTokenBase, ERC20PermitBase, ERC20AllowanceBase {
  using WadRayMath for uint256;
  using PercentageMath for uint256;
  using SafeERC20 for IERC20;

  uint32 private constant FLAG_OUT_BALANCE = 1 << 0;
  uint32 private constant FLAG_ALLOW_OVERDRAFT = 1 << 1;
  uint32 private constant FLAG_IN_BALANCE = 1 << 2;

  address internal _treasury;

  struct InBalance {
    uint128 allowance;
    uint128 overdraft;
  }

  struct OutBalance {
    uint128 outBalance;
  }

  uint8 internal constant ACCESS_SUB_BALANCE = uint8(1) << 0;
  uint8 internal constant ACCESS_LOCK_BALANCE = uint8(1) << 1;
  // uint8 internal constant ACCESS_TRANSFER = uint8(1)<<2;

  mapping(address => uint8) private _subBalanceOperators;
  mapping(address => OutBalance) private _outBalances;
  mapping(address => InBalance) private _inBalances;
  uint256 private _totalOverdraft;
  uint16 private _overdraftTolerancePct;

  constructor(address treasury_) {
    _treasury = treasury_;
    _overdraftTolerancePct = PercentageMath.HALF_ONE;
  }

  function _initializePoolToken(PoolTokenConfig memory config, bytes calldata params) internal virtual override {
    require(config.treasury != address(0), Errors.VL_TREASURY_REQUIRED);
    super._initializeDomainSeparator();
    super._initializePoolToken(config, params);
    _overdraftTolerancePct = PercentageMath.HALF_ONE;
    _treasury = config.treasury;
  }

  function getTreasury() external view returns (address) {
    return _treasury;
  }

  function updateTreasury() external override onlyLendingPoolConfiguratorOrAdmin {
    address treasury = _pool.getAccessController().getAddress(AccessFlags.TREASURY);
    require(treasury != address(0), Errors.VL_TREASURY_REQUIRED);
    _treasury = treasury;
  }

  function addSubBalanceOperator(address addr) external override onlyLendingPoolConfiguratorOrAdmin {
    _addSubBalanceOperator(addr, ACCESS_SUB_BALANCE);
  }

  function addStakeOperator(address addr) external override onlyLendingPoolConfiguratorOrAdmin {
    _addSubBalanceOperator(addr, ACCESS_LOCK_BALANCE);
  }

  function _addSubBalanceOperator(address addr, uint8 accessMode) private {
    require(addr != address(0), 'address is required');
    _subBalanceOperators[addr] |= accessMode;
  }

  function removeSubBalanceOperator(address addr) external override onlyLendingPoolConfiguratorOrAdmin {
    delete (_subBalanceOperators[addr]);
  }

  function getSubBalanceOperatorAccess(address addr) private view returns (uint8) {
    if (addr == address(_pool)) {
      return ~uint8(0);
    }
    return _subBalanceOperators[addr];
  }

  function getScaleIndex() public view override returns (uint256) {
    return _pool.getReserveNormalizedIncome(_underlyingAsset);
  }

  function _onlySubBalanceOperator(address recipient) private view {
    uint8 accessMode = getSubBalanceOperatorAccess(msg.sender);
    require(
      accessMode & (recipient != address(0) ? ACCESS_SUB_BALANCE : ACCESS_LOCK_BALANCE) != 0,
      Errors.AT_CALLER_NOT_SUB_BALANCE_OPERATOR
    );
  }

  modifier onlySubBalanceOperator(address recipient) {
    _onlySubBalanceOperator(recipient);
    _;
  }

  function provideSubBalance(
    address provider,
    address recipient,
    uint256 scaledAmount
  ) external override onlySubBalanceOperator(recipient) {
    require(provider != address(0) && provider != recipient, Errors.VL_INVALID_SUB_BALANCE_ARGS);

    {
      (uint256 balance, uint32 flags) = internalBalanceAndFlagsOf(provider);
      uint256 outBalance = scaledAmount + _outBalances[provider].outBalance;
      require(outBalance <= balance, Errors.VL_NOT_ENOUGH_AVAILABLE_USER_BALANCE);

      require(outBalance <= type(uint128).max, 'balance is too high');
      _outBalances[provider].outBalance = uint128(outBalance);

      if (flags & FLAG_OUT_BALANCE == 0) {
        internalSetFlagsOf(provider, flags | FLAG_OUT_BALANCE);
      }
    }

    if (recipient != address(0)) {
      (, uint32 flags) = internalBalanceAndFlagsOf(recipient);
      require(flags & FLAG_ALLOW_OVERDRAFT != 0, Errors.AT_OVERDRAFT_DISABLED);
      scaledAmount += _inBalances[recipient].allowance;

      require(scaledAmount <= type(uint128).max, 'balance is too high');
      _inBalances[recipient].allowance = uint128(scaledAmount);

      if (flags & FLAG_IN_BALANCE == 0) {
        internalSetFlagsOf(recipient, flags | FLAG_IN_BALANCE);
      }
    }

    uint256 index = getScaleIndex();
    emit SubBalanceProvided(provider, recipient, scaledAmount.rayMul(index), index);
  }

  function returnSubBalance(
    address provider,
    address recipient,
    uint256 scaledAmount,
    bool preferOverdraft
  ) external override onlySubBalanceOperator(recipient) returns (uint256) {
    require(provider != address(0) && provider != recipient, Errors.VL_INVALID_SUB_BALANCE_ARGS);

    uint256 index = getScaleIndex();
    uint128 overdraft;

    if (recipient != address(0)) {
      (, uint32 flags) = internalBalanceAndFlagsOf(recipient);
      require(flags & FLAG_ALLOW_OVERDRAFT != 0, Errors.AT_OVERDRAFT_DISABLED);

      InBalance memory inBalance = _inBalances[recipient];

      if (
        inBalance.overdraft > 0 &&
        (preferOverdraft || inBalance.overdraft >= scaledAmount.percentMul(_overdraftTolerancePct))
      ) {
        if (inBalance.overdraft > scaledAmount) {
          overdraft = uint128(scaledAmount);
          unchecked {
            inBalance.overdraft -= uint128(scaledAmount);
          }
        } else {
          overdraft = inBalance.overdraft;
          inBalance.overdraft = 0;
        }
        _totalOverdraft -= overdraft;
      }
      inBalance.allowance = uint128(uint256(inBalance.allowance) - (scaledAmount - overdraft));

      _inBalances[recipient] = inBalance;
      if (inBalance.allowance == 0) {
        internalSetFlagsOf(recipient, flags & ~FLAG_IN_BALANCE);
      }
    }

    {
      uint256 outBalance = uint256(_outBalances[provider].outBalance) - scaledAmount;

      if (overdraft > 0) {
        // A provider of overdraft is not know when overdraft is applied, so there is an excess of tokens minted at that time.
        // So this excess of tokens will be burned here.

        _burnBalance(provider, overdraft, outBalance, index);
        emit OverdraftCovered(provider, recipient, uint256(overdraft).rayMul(index), index);
      }
      _outBalances[provider].outBalance = uint128(outBalance);

      if (outBalance == 0) {
        (, uint32 flags) = internalBalanceAndFlagsOf(recipient);
        internalSetFlagsOf(recipient, flags & ~FLAG_OUT_BALANCE);
      }
    }

    emit SubBalanceReturned(provider, recipient, scaledAmount.rayMul(index), index);
    return overdraft;
  }

  function mint(
    address user,
    uint256 amount,
    uint256 index,
    bool repayOverdraft
  ) external override onlyLendingPool returns (bool) {
    uint256 amountScaled = amount.rayDiv(index);
    require(amountScaled != 0, Errors.CT_INVALID_MINT_AMOUNT);

    (uint256 firstBalance, uint32 flags) = internalBalanceAndFlagsOf(user);
    if (repayOverdraft && flags & FLAG_IN_BALANCE != 0) {
      InBalance memory inBalance = _inBalances[user];

      if (inBalance.overdraft > 0) {
        unchecked {
          if (inBalance.overdraft >= amountScaled) {
            inBalance.overdraft -= uint128(amountScaled);
            _inBalances[user] = inBalance;
            return firstBalance == 0;
          }
          amountScaled -= inBalance.overdraft;
        }
        inBalance.overdraft = 0;
        _inBalances[user] = inBalance;
      }
    }

    _mintBalance(user, amountScaled, index);
    emit Transfer(address(0), user, amount);
    emit Mint(user, amount, index);

    return firstBalance == 0;
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
    _burnBalance(user, amountScaled, _outBalances[user].outBalance, index);

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
  ) external override onlyLendingPool returns (bool firstBalance) {
    uint256 scaledAmount = amount.rayDiv(index);
    if (scaledAmount == 0) {
      return false;
    }

    firstBalance = internalBalanceOf(receiver) == 0;
    (uint256 scaledBalanceFrom, uint32 flags) = internalBalanceAndFlagsOf(user);

    uint256 outBalance;
    if (flags & FLAG_OUT_BALANCE != 0) {
      outBalance = _outBalances[user].outBalance;
    }

    if (flags & FLAG_IN_BALANCE != 0 && scaledAmount + outBalance > scaledBalanceFrom) {
      // lack of own funds - use overdraft

      uint256 requiredAmount;
      unchecked {
        requiredAmount = scaledAmount + outBalance - scaledBalanceFrom;
      }

      InBalance memory inBalance = _inBalances[user];
      if (inBalance.allowance > requiredAmount) {
        unchecked {
          inBalance.allowance -= uint128(requiredAmount);
        }
        inBalance.overdraft += uint128(requiredAmount);
      } else {
        inBalance.overdraft += inBalance.allowance;
        requiredAmount = inBalance.allowance;
        inBalance.allowance = 0;
      }

      scaledAmount -= requiredAmount;
      if (!transferUnderlying) {
        // A provider of overdraft is not known here and tokens cant be transferred from it.
        // So new tokens will be minted here for liquidator and existing tokens will
        // be burned when the provider will return its sub-balance.
        //
        // But the totalSupply will remain unchanged as it is reduced by _totalOverdraft.

        _mintBalance(receiver, requiredAmount, index);
        _totalOverdraft += requiredAmount;

        emit OverdraftApplied(user, requiredAmount.rayMul(index), index);
      }
    }

    if (transferUnderlying) {
      // Burn the equivalent amount of tokens, sending the underlying to the liquidator
      _burnBalance(user, scaledAmount, outBalance, index);
      IERC20(_underlyingAsset).safeTransfer(receiver, amount);

      emit Transfer(user, address(0), amount);
      emit Burn(user, receiver, amount, index);
      return false;
    }

    super._transferBalance(user, receiver, scaledAmount, outBalance, index);

    emit BalanceTransfer(user, receiver, amount, index);
    emit Transfer(user, receiver, amount);
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

  function scaledBalanceOf(address user) public view override returns (uint256) {
    (uint256 userBalance, uint32 flags) = internalBalanceAndFlagsOf(user);
    if (userBalance == 0) {
      return 0;
    }
    if (flags & FLAG_OUT_BALANCE == 0) {
      return userBalance;
    }

    return userBalance - _outBalances[user].outBalance;
  }

  function scaledRewardedBalanceOf(address user) external view override returns (uint256) {
    return internalBalanceOf(user);
  }

  function collateralBalanceOf(address user) public view override returns (uint256) {
    (uint256 userBalance, uint32 flags) = internalBalanceAndFlagsOf(user);
    if (flags & FLAG_OUT_BALANCE != 0) {
      // the out-balance can only be with own finds, hence it is subtracted before adding the in-balance
      userBalance -= _outBalances[user].outBalance;
    }
    if (flags & FLAG_IN_BALANCE != 0) {
      userBalance += _inBalances[user].allowance;
    }
    if (userBalance == 0) {
      return 0;
    }
    return userBalance.rayMul(getScaleIndex());
  }

  function getScaledUserBalanceAndSupply(address user) external view override returns (uint256, uint256) {
    return (scaledBalanceOf(user), scaledTotalSupply());
  }

  function totalSupply() public view override(IERC20, PoolTokenBase) returns (uint256) {
    uint256 currentSupplyScaled = scaledTotalSupply();
    if (currentSupplyScaled == 0) {
      return 0;
    }
    return currentSupplyScaled.rayMul(getScaleIndex());
  }

  function scaledTotalSupply() public view virtual override returns (uint256) {
    return super.totalSupply() - _totalOverdraft;
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
    // uint8 accessMode = getSubBalanceOperatorAccess(msg.sender);
    // require(accessMode & ACCESS_TRANSFER != 0, Errors.AT_CALLER_NOT_ALLOWED_TO_TRANSFER);
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
    uint256 index = getScaleIndex();
    uint256 scaledAmount = amount.rayDiv(index);

    (uint256 scaledBalanceBeforeFrom, uint256 flags) = internalBalanceAndFlagsOf(from);
    uint256 scaledBalanceBeforeTo = internalBalanceOf(to);

    if (flags & FLAG_OUT_BALANCE != 0) {
      super._transferBalance(from, to, scaledAmount, _outBalances[from].outBalance, index);
    } else {
      super._transferBalance(from, to, scaledAmount, 0, index);
    }

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
