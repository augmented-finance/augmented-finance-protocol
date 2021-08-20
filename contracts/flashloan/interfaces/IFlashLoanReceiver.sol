// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../../interfaces/IFlashLoanAddressProvider.sol';
import '../../interfaces/ILendingPool.sol';

// solhint-disable func-name-mixedcase
/**
 * @title IFlashLoanReceiver interface
 * @notice Interface for the Aave fee IFlashLoanReceiver.
 * @author Aave
 * @dev implement this interface to develop a flashloan-compatible flashLoanReceiver contract
 **/
interface IFlashLoanReceiver {
  function executeOperation(
    address[] calldata assets,
    uint256[] calldata amounts,
    uint256[] calldata premiums,
    address initiator,
    bytes calldata params
  ) external returns (bool);

  function ADDRESS_PROVIDER() external view returns (IFlashLoanAddressProvider);

  function LENDING_POOL() external view returns (ILendingPool);
}
