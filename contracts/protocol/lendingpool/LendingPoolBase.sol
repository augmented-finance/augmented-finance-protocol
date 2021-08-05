// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import '../../dependencies/openzeppelin/contracts/SafeMath.sol';
import '../../dependencies/openzeppelin/contracts/IERC20.sol';
import '../../dependencies/openzeppelin/contracts/SafeERC20.sol';
import {Address} from '../../dependencies/openzeppelin/contracts/Address.sol';
import '../../access/interfaces/IMarketAccessController.sol';
import '../../access/AccessHelper.sol';
import '../../access/AccessFlags.sol';
import '../../interfaces/IDepositToken.sol';
import '../../interfaces/IVariableDebtToken.sol';
import '../../flashloan/interfaces/IFlashLoanReceiver.sol';
import '../../interfaces/IStableDebtToken.sol';
import '../../tools/upgradeability/VersionedInitializable.sol';
import '../libraries/helpers/Helpers.sol';
import {Errors} from '../libraries/helpers/Errors.sol';
import {WadRayMath} from '../../tools/math/WadRayMath.sol';
import '../../tools/math/PercentageMath.sol';
import {GenericLogic} from '../libraries/logic/GenericLogic.sol';
import {ValidationLogic} from '../libraries/logic/ValidationLogic.sol';
import '../libraries/types/DataTypes.sol';
import {LendingPoolStorage} from './LendingPoolStorage.sol';
import '../../interfaces/ILendingPool.sol';
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
}
