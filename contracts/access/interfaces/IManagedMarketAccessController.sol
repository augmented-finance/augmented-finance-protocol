// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import './IMarketAccessController.sol';

interface IManagedMarketAccessController is IMarketAccessController {
  event MarketIdSet(string newMarketId);

  function setMarketId(string memory marketId) external;
}
