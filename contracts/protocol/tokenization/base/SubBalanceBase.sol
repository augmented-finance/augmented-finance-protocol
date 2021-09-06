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

abstract contract SubBalanceBase is IDepositToken, RewardedTokenBase {
  using WadRayMath for uint256;
  using PercentageMath for uint256;
  using SafeERC20 for IERC20;

  uint32 private constant FLAG_OUT_BALANCE = 1 << 0;
  uint32 private constant FLAG_ALLOW_OVERDRAFT = 1 << 1;
  uint32 private constant FLAG_IN_BALANCE = 1 << 2;

  struct InBalance {
    uint128 allowance;
    uint128 overdraft;
  }

  struct OutBalance {
    uint128 outBalance;
  }

  uint8 internal constant ACCESS_SUB_BALANCE = uint8(1) << 0;
  uint8 internal constant ACCESS_LOCK_BALANCE = uint8(1) << 1;
  uint8 internal constant ACCESS_TRANSFER = uint8(1) << 2;

  mapping(address => uint8) private _subBalanceOperators;
  mapping(address => OutBalance) private _outBalances;
  mapping(address => InBalance) private _inBalances;
  uint256 private _totalOverdraft;
  uint16 private _overdraftTolerancePct = PercentageMath.HALF_ONE;

  function internalSetOverdraftTolerancePct(uint16 overdraftTolerancePct) internal {
    require(overdraftTolerancePct <= PercentageMath.ONE);
    _overdraftTolerancePct = overdraftTolerancePct;
  }

  function _addSubBalanceOperator(address addr, uint8 accessMode) internal {
    require(addr != address(0), 'address is required');
    _subBalanceOperators[addr] |= accessMode;
  }

  function _removeSubBalanceOperator(address addr) internal {
    delete (_subBalanceOperators[addr]);
  }

  function getSubBalanceOperatorAccess(address addr) internal view virtual returns (uint8) {
    return _subBalanceOperators[addr];
  }

  function getScaleIndex() public view virtual override returns (uint256);

  function _onlySubBalanceOperator(uint8 requiredMode) private view returns (uint8 accessMode) {
    accessMode = getSubBalanceOperatorAccess(msg.sender);
    require(accessMode & requiredMode != 0, Errors.AT_SUB_BALANCE_RESTIRCTED_FUNCTION);
    return accessMode;
  }

  modifier onlySubBalanceOperator() {
    _onlySubBalanceOperator(ACCESS_SUB_BALANCE);
    _;
  }

  function provideSubBalance(
    address provider,
    address recipient,
    uint256 scaledAmount
  ) external override onlySubBalanceOperator {
    require(recipient != address(0), Errors.VL_INVALID_SUB_BALANCE_ARGS);
    _checkSubBalanceArgs(provider, recipient, scaledAmount);

    _incrementOutBalance(provider, scaledAmount);
    _incrementInBalance(recipient, scaledAmount);

    uint256 index = getScaleIndex();
    emit SubBalanceProvided(provider, recipient, scaledAmount.rayMul(index), index);
  }

  function lockSubBalance(address provider, uint256 scaledAmount) external override {
    _onlySubBalanceOperator(ACCESS_LOCK_BALANCE);
    _checkSubBalanceArgs(provider, address(0), scaledAmount);

    _incrementOutBalance(provider, scaledAmount);

    uint256 index = getScaleIndex();
    emit SubBalanceLocked(provider, scaledAmount.rayMul(index), index);
  }

  function _incrementOutBalance(address provider, uint256 scaledAmount) private {
    _incrementOutBalanceNoCheck(provider, scaledAmount);
    _ensureHealthFactor(provider);
  }

  function _incrementOutBalanceNoCheck(address provider, uint256 scaledAmount) private {
    (uint256 balance, uint32 flags) = internalBalanceAndFlagsOf(provider);
    uint256 outBalance = scaledAmount + _outBalances[provider].outBalance;

    require(outBalance <= balance, Errors.VL_NOT_ENOUGH_AVAILABLE_USER_BALANCE);
    require(outBalance <= type(uint128).max, 'balance is too high');

    _outBalances[provider].outBalance = uint128(outBalance);

    if (flags & FLAG_OUT_BALANCE == 0) {
      internalSetFlagsOf(provider, flags | FLAG_OUT_BALANCE);
    }

    _ensureHealthFactor(provider);
  }

  function _ensureHealthFactor(address provider) internal virtual;

  function _decrementOutBalance(
    address provider,
    uint256 scaledAmount,
    uint256 coveredOverdraft,
    uint256 index
  ) private returns (uint256) {
    uint256 outBalance = uint256(_outBalances[provider].outBalance) - scaledAmount;

    if (coveredOverdraft > 0) {
      // A provider of overdraft is not know when overdraft is applied, so there is an excess of tokens minted at that time.
      // So this excess of tokens will be burned here.
      _burnBalance(provider, coveredOverdraft, outBalance, index);
    }
    _outBalances[provider].outBalance = uint128(outBalance);

    if (outBalance == 0) {
      (, uint32 flags) = internalBalanceAndFlagsOf(provider);
      internalSetFlagsOf(provider, flags & ~FLAG_OUT_BALANCE);
    }
    return outBalance;
  }

  function _incrementInBalance(address recipient, uint256 scaledAmount) private {
    (, uint32 flags) = internalBalanceAndFlagsOf(recipient);
    require(flags & FLAG_ALLOW_OVERDRAFT != 0, Errors.AT_OVERDRAFT_DISABLED);
    scaledAmount += _inBalances[recipient].allowance;

    require(scaledAmount <= type(uint128).max, 'balance is too high');
    _inBalances[recipient].allowance = uint128(scaledAmount);

    if (flags & FLAG_IN_BALANCE == 0) {
      internalSetFlagsOf(recipient, flags | FLAG_IN_BALANCE);
    }
  }

  function _decrementInBalance(
    address recipient,
    uint256 scaledAmount,
    bool preferOverdraft
  ) private returns (uint256 overdraft) {
    InBalance memory inBalance = _inBalances[recipient];

    if (
      inBalance.overdraft > 0 &&
      (scaledAmount > inBalance.allowance ||
        (preferOverdraft && inBalance.overdraft >= scaledAmount.percentMul(_overdraftTolerancePct)))
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
      (, uint32 flags) = internalBalanceAndFlagsOf(recipient);
      internalSetFlagsOf(recipient, flags & ~FLAG_IN_BALANCE);
    }
  }

  function _checkSubBalanceArgs(
    address provider,
    address recipient,
    uint256 scaledAmount
  ) private pure {
    require(scaledAmount > 0, Errors.VL_INVALID_SUB_BALANCE_ARGS);
    require(provider != address(0) && provider != recipient, Errors.VL_INVALID_SUB_BALANCE_ARGS);
  }

  function replaceSubBalance(
    address prevProvider,
    address recipient,
    uint256 prevScaledAmount,
    address newProvider,
    uint256 newScaledAmount
  ) external override onlySubBalanceOperator returns (uint256) {
    require(recipient != address(0), Errors.VL_INVALID_SUB_BALANCE_ARGS);
    _checkSubBalanceArgs(prevProvider, recipient, prevScaledAmount);

    if (prevProvider != newProvider) {
      _checkSubBalanceArgs(newProvider, recipient, newScaledAmount);
      _incrementOutBalance(newProvider, newScaledAmount);
    } else if (prevScaledAmount == newScaledAmount) {
      return 0;
    }

    uint256 overdraft;
    uint256 delta;
    uint256 compensation;
    if (prevScaledAmount > newScaledAmount) {
      unchecked {
        delta = prevScaledAmount - newScaledAmount;
      }
      overdraft = _decrementInBalance(recipient, delta, true);
      if (delta > overdraft) {
        unchecked {
          compensation = delta - overdraft;
        }
      }
    } else if (prevScaledAmount < newScaledAmount) {
      unchecked {
        delta = newScaledAmount - prevScaledAmount;
      }
      _incrementInBalance(recipient, delta);
    }

    uint256 index = getScaleIndex();
    emit SubBalanceReturned(prevProvider, recipient, prevScaledAmount.rayMul(index), index);

    uint256 outBalance;
    if (prevProvider != newProvider) {
      outBalance = _decrementOutBalance(prevProvider, prevScaledAmount, overdraft, index);
    } else if (prevScaledAmount > newScaledAmount) {
      outBalance = _decrementOutBalance(prevProvider, delta, overdraft, index);
    } else {
      _incrementOutBalance(newProvider, delta);
    }

    if (overdraft > 0) {
      emit OverdraftCovered(prevProvider, recipient, uint256(overdraft).rayMul(index), index);
    }
    emit SubBalanceProvided(newProvider, recipient, newScaledAmount.rayMul(index), index);

    if (compensation > 0) {
      _transferScaled(prevProvider, recipient, compensation, outBalance, index);
    }

    return overdraft;
  }

  function returnSubBalance(
    address provider,
    address recipient,
    uint256 scaledAmount,
    bool preferOverdraft
  ) external override onlySubBalanceOperator returns (uint256) {
    require(recipient != address(0), Errors.VL_INVALID_SUB_BALANCE_ARGS);
    _checkSubBalanceArgs(provider, recipient, scaledAmount);

    uint256 overdraft = _decrementInBalance(recipient, scaledAmount, preferOverdraft);
    _ensureHealthFactor(recipient);

    uint256 index = getScaleIndex();
    _decrementOutBalance(provider, scaledAmount, overdraft, index);
    if (overdraft > 0) {
      emit OverdraftCovered(provider, recipient, uint256(overdraft).rayMul(index), index);
    }

    emit SubBalanceReturned(provider, recipient, scaledAmount.rayMul(index), index);
    return overdraft;
  }

  function unlockSubBalance(
    address provider,
    uint256 scaledAmount,
    address transferTo
  ) external override {
    uint8 accessMode = _onlySubBalanceOperator(ACCESS_LOCK_BALANCE);

    _checkSubBalanceArgs(provider, address(0), scaledAmount);

    uint256 index = getScaleIndex();
    uint256 outBalance = _decrementOutBalance(provider, scaledAmount, 0, index);

    emit SubBalanceUnlocked(provider, scaledAmount.rayMul(index), index);

    if (transferTo != address(0) && transferTo != provider) {
      require(accessMode & ACCESS_TRANSFER != 0, Errors.AT_SUB_BALANCE_RESTIRCTED_FUNCTION);
      _transferScaled(provider, transferTo, scaledAmount, outBalance, index);
    }
  }

  function transferLockedBalance(
    address from,
    address to,
    uint256 scaledAmount
  ) external override {
    _onlySubBalanceOperator(ACCESS_LOCK_BALANCE | ACCESS_SUB_BALANCE);
    require(from != address(0) || to != address(0), Errors.VL_INVALID_SUB_BALANCE_ARGS);
    if (scaledAmount == 0) {
      return;
    }

    uint256 index = getScaleIndex();
    uint256 amount = scaledAmount.rayMul(index);

    _decrementOutBalance(from, scaledAmount, 0, index);
    emit SubBalanceUnlocked(from, amount, index);

    _transferScaled(from, to, scaledAmount, 0, index);

    _incrementOutBalanceNoCheck(to, scaledAmount);
    emit SubBalanceLocked(to, amount, index);
  }

  function _mintToSubBalance(
    address user,
    uint256 amountScaled,
    bool repayOverdraft
  ) internal returns (bool) {
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
    return firstBalance == 0;
  }

  function _liquidateWithSubBalance(
    address user,
    address receiver,
    uint256 scaledAmount,
    uint256 index,
    bool transferUnderlying
  ) internal returns (bool firstBalance, uint256 outBalance) {
    firstBalance = internalBalanceOf(receiver) == 0;
    (uint256 scaledBalanceFrom, uint32 flags) = internalBalanceAndFlagsOf(user);

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
  }

  function getMinBalance(address user) internal view returns (uint256) {
    return _outBalances[user].outBalance;
  }

  function getMinBalance(address user, uint256 flags) internal view returns (uint256) {
    return flags & FLAG_OUT_BALANCE != 0 ? _outBalances[user].outBalance : 0;
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

  function scaledTotalSupply() public view override returns (uint256) {
    return super.totalSupply() - _totalOverdraft;
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

  function _transferScaled(
    address from,
    address to,
    uint256 scaledAmount,
    uint256 outBalance,
    uint256 index
  ) internal virtual;
}
