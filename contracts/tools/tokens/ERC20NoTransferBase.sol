// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../../dependencies/openzeppelin/contracts/IERC20.sol';

abstract contract ERC20NoTransferBase is IERC20 {
  function transfer(address, uint256) public pure override returns (bool) {
    notSupported();
    return false;
  }

  function allowance(address, address) public pure override returns (uint256) {
    return 0;
  }

  function approve(address, uint256) public pure override returns (bool) {
    notSupported();
    return false;
  }

  function transferFrom(
    address,
    address,
    uint256
  ) public pure override returns (bool) {
    notSupported();
    return false;
  }

  function notSupported() private pure {
    revert('NOT_SUPPORTED');
  }
}
