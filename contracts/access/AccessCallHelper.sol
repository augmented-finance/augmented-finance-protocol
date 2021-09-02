// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../dependencies/openzeppelin/contracts/Address.sol';
import '../tools/Errors.sol';

contract AccessCallHelper {
  address private _owner;

  constructor(address owner) {
    require(owner != address(0));
    _owner = owner;
  }

  function doCall(address callAddr, bytes calldata callData) external returns (bytes memory result) {
    require(msg.sender == _owner, Errors.TXT_OWNABLE_CALLER_NOT_OWNER);
    return Address.functionCall(callAddr, callData);
  }
}
