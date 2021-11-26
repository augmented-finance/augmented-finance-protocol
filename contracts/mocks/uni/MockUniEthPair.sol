// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

interface IMockUniswapV2Pair {
  function token0() external view returns (address);

  function token1() external view returns (address);

  function getReserves()
    external
    view
    returns (
      uint112 reserve0,
      uint112 reserve1,
      uint32 timestamp
    );
}

contract MockUniEthPair is IMockUniswapV2Pair {
  address private immutable _firstToken;
  address private immutable _secondToken;

  uint112 private immutable _reserve0;
  uint112 private immutable _reserve1;

  constructor(
    address firstToken,
    address secondToken,
    uint112 reserve0,
    uint112 reserve1
  ) {
    _firstToken = firstToken;
    _secondToken = secondToken;
    _reserve0 = reserve0;
    _reserve1 = reserve1;
  }

  function token0() external view override returns (address) {
    return _firstToken;
  }

  function token1() external view override returns (address) {
    return _secondToken;
  }

  function getReserves()
    external
    view
    override
    returns (
      uint112 reserve0,
      uint112 reserve1,
      uint32 timestamp
    )
  {
    return (_reserve0, _reserve1, uint32(block.timestamp));
  }
}
