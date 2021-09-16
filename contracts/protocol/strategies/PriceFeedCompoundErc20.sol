// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../../dependencies/compound-protocol/contracts/ICToken.sol';
import '../../interfaces/IChainlinkAggregator.sol';
import '../../tools/tokens/IERC20Details.sol';
import './PriceFeedCompoundBase.sol';

contract PriceFeedCompoundErc20 is PriceFeedCompoundBase {
  IChainlinkAggregatorMin private _underlyingSource;

  constructor(ICTokenErc20 token, IChainlinkAggregatorMin underlyingSource)
    PriceFeedCompoundBase(token, IERC20Details(token.underlying()).decimals())
  {
    _underlyingSource = underlyingSource;
    updatePrice();
  }

  function getUnderlyingSource() internal view override returns (address) {
    return address(_underlyingSource);
  }

  function latestUnderlyingAnswer() internal view override returns (uint256) {
    return uint256(_underlyingSource.latestAnswer());
  }

  function latestTimestamp() public view override returns (uint256) {
    return _underlyingSource.latestTimestamp();
  }
}
