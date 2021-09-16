// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../../dependencies/compound-protocol/contracts/ICToken.sol';
import './PriceFeedCompoundBase.sol';

contract PriceFeedCompoundEth is PriceFeedCompoundBase {
  constructor(ICToken token) PriceFeedCompoundBase(token, 18) {
    updatePrice();
  }

  function getUnderlyingSource() internal pure override returns (address) {
    return address(0);
  }

  function latestUnderlyingAnswer() internal pure override returns (uint256) {
    return 1 ether;
  }

  function latestTimestamp() public view override returns (uint256) {
    return block.timestamp;
  }
}
