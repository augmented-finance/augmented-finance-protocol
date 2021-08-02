// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {SafeMath} from '../../dependencies/openzeppelin/contracts/SafeMath.sol';
import {IERC20} from '../../dependencies/openzeppelin/contracts/IERC20.sol';
import {SafeERC20} from '../../dependencies/openzeppelin/contracts/SafeERC20.sol';
import {Address} from '../../dependencies/openzeppelin/contracts/Address.sol';
import {IMarketAccessController} from '../../access/interfaces/IMarketAccessController.sol';
import {AccessHelper} from '../../access/AccessHelper.sol';
import {AccessFlags} from '../../access/AccessFlags.sol';
import {IDepositToken} from '../../interfaces/IDepositToken.sol';
import {IVariableDebtToken} from '../../interfaces/IVariableDebtToken.sol';
import {IFlashLoanReceiver} from '../../flashloan/interfaces/IFlashLoanReceiver.sol';
import {IStableDebtToken} from '../../interfaces/IStableDebtToken.sol';
import {VersionedInitializable} from '../../tools/upgradeability/VersionedInitializable.sol';
import {Helpers} from '../libraries/helpers/Helpers.sol';
import {Errors} from '../libraries/helpers/Errors.sol';
import {WadRayMath} from '../../tools/math/WadRayMath.sol';
import {PercentageMath} from '../../tools/math/PercentageMath.sol';
import {GenericLogic} from '../libraries/logic/GenericLogic.sol';
import {ValidationLogic} from '../libraries/logic/ValidationLogic.sol';
import {DataTypes} from '../libraries/types/DataTypes.sol';
import {LendingPoolStorage} from './LendingPoolStorage.sol';
import {ILendingPool} from '../../interfaces/ILendingPool.sol';
import {Delegator} from '../../tools/upgradeability/Delegator.sol';

import 'hardhat/console.sol';

contract LendingPoolBase is LendingPoolStorage {
  using SafeMath for uint256;
  using WadRayMath for uint256;
  using PercentageMath for uint256;
  using SafeERC20 for IERC20;
  using AccessHelper for IMarketAccessController;

  function _whenNotPaused() private view {
    require(!_paused, Errors.LP_IS_PAUSED);
  }

  modifier whenNotPaused() {
    _whenNotPaused();
    _;
  }

  function _onlyLendingPoolConfigurator() private view {
    require(
      _addressesProvider.hasAllOf(msg.sender, AccessFlags.LENDING_POOL_CONFIGURATOR),
      Errors.LP_CALLER_NOT_LENDING_POOL_CONFIGURATOR
    );
  }

  modifier onlyLendingPoolConfigurator() {
    // This trick makes generated code smaller when modifier is applied multiple times.
    _onlyLendingPoolConfigurator();
    _;
  }

  function _onlyConfiguratorOrAdmin() private view {
    require(
      _addressesProvider.hasAnyOf(
        msg.sender,
        AccessFlags.POOL_ADMIN | AccessFlags.LENDING_POOL_CONFIGURATOR
      ),
      Errors.CALLER_NOT_POOL_ADMIN
    );
  }

  modifier onlyConfiguratorOrAdmin() {
    // This trick makes generated code smaller when modifier is applied multiple times.
    _onlyConfiguratorOrAdmin();
    _;
  }

  function _notNested() private view {
    require(_nestedCalls == 0, Errors.LP_TOO_MANY_NESTED_CALLS);
  }

  modifier notNested {
    _notNested();
    _;
  }

  function validateOnBehalf(address onBehalf, uint256 mask) internal view {
    if (msg.sender != onBehalf) {
      require(_delegations[onBehalf][msg.sender] & mask == mask, Errors.LP_RESTRICTED_ON_BEHALF);
    }
  }
}
