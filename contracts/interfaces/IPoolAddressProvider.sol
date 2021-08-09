// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

import './IPriceOracleProvider.sol';

interface IPoolAddressProvider is IPriceOracleProvider {
  function getLendingPool() external view returns (address);
}
