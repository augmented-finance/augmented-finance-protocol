// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {ILendingPool} from '../../../interfaces/ILendingPool.sol';
import {IBalanceHook} from '../../../interfaces/IBalanceHook.sol';
import {PoolTokenConfig} from './PoolTokenConfig.sol';

/**
 * @title IInitializablePoolToken
 * @notice Interface for the initialize function on PoolToken or DeptToken
 **/
interface IInitializablePoolToken {
  /**
   * @dev Emitted when a token is initialized
   * @param underlyingAsset The address of the underlying asset
   * @param pool The address of the associated lending pool
   * @param treasury The address of the treasury
   * @param depositTokenName the name of the depositToken
   * @param depositTokenSymbol the symbol of the depositToken
   * @param depositTokenDecimals the decimals of the underlying
   * @param params A set of encoded parameters for additional initialization
   **/
  event Initialized(
    address indexed underlyingAsset,
    address indexed pool,
    address treasury,
    string depositTokenName,
    string depositTokenSymbol,
    uint8 depositTokenDecimals,
    bytes params
  );

  /**
   * @dev Initializes the depositToken
   * @param config The data about lending pool where this token will be used
   * @param depositTokenName The name of the depositToken
   * @param depositTokenSymbol The symbol of the depositToken
   * @param depositTokenDecimals The decimals of the depositToken, same as the underlying asset's
   */
  function initialize(
    PoolTokenConfig calldata config,
    string calldata depositTokenName,
    string calldata depositTokenSymbol,
    uint8 depositTokenDecimals,
    bytes calldata params
  ) external;
}
