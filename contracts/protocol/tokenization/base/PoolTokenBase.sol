// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {Context} from '../../../dependencies/openzeppelin/contracts/Context.sol';
import {ILendingPool} from '../../../interfaces/ILendingPool.sol';
import {IInitializablePoolToken} from '../interfaces/IInitializablePoolToken.sol';
import {IPoolToken} from '../../../interfaces/IPoolToken.sol';
import {PoolTokenConfig} from '../interfaces/PoolTokenConfig.sol';
import {IBalanceHook} from '../../../interfaces/IBalanceHook.sol';
import {Errors} from '../../libraries/helpers/Errors.sol';

abstract contract PoolTokenBase is Context, IInitializablePoolToken, IPoolToken {
  ILendingPool internal _pool;
  address internal _underlyingAsset;

  /**
   * @dev Only lending pool can call functions marked by this modifier
   **/
  modifier onlyLendingPool {
    require(_msgSender() == address(_pool), Errors.CT_CALLER_MUST_BE_LENDING_POOL);
    _;
  }

  modifier onlyRewardAdmin {
    require(
      _pool.getAccessController().isRewardAdmin(_msgSender()),
      Errors.CT_CALLER_MUST_BE_REWARD_ADMIN
    );
    _;
  }

  function _initializePoolToken(
    PoolTokenConfig memory config,
    string memory debtTokenName,
    string memory debtTokenSymbol,
    uint8 debtTokenDecimals,
    bytes calldata params
  ) internal {
    _pool = config.pool;
    _underlyingAsset = config.underlyingAsset;

    emit Initialized(
      config.underlyingAsset,
      address(config.pool),
      address(config.treasury),
      debtTokenName,
      debtTokenSymbol,
      debtTokenDecimals,
      params
    );
  }

  /**
   * @dev Returns the address of the underlying asset of this aToken (E.g. WETH for aWETH)
   **/
  function UNDERLYING_ASSET_ADDRESS() public view override returns (address) {
    return _underlyingAsset;
  }

  /**
   * @dev Returns the address of the lending pool where this aToken is used
   **/
  function POOL() public view override returns (ILendingPool) {
    return _pool;
  }
}
