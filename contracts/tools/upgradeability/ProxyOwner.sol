// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {IProxy} from './IProxy.sol';

contract ProxyOwner {
  address private _owner;

  constructor() public {
    _owner = msg.sender;
  }

  modifier onlyOwner {
    require(msg.sender == _owner, 'ProxyOwner: only owner');
    _;
  }

  function adminOf(address proxy) external returns (address) {
    return IProxy(proxy).admin();
  }

  function implementationOf(address proxy) external returns (address) {
    return IProxy(proxy).implementation();
  }

  function upgradeTo(address proxy, address newImplementation) external onlyOwner {
    IProxy(proxy).upgradeTo(newImplementation);
  }

  function upgradeToAndCall(
    address proxy,
    address newImplementation,
    bytes calldata data
  ) external payable onlyOwner {
    IProxy(proxy).upgradeToAndCall(newImplementation, data);
  }
}
