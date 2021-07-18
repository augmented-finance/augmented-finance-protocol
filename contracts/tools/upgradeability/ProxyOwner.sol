// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import './IProxy.sol';

contract ProxyOwner {
  address private _owner;

  constructor() public {
    _owner = msg.sender;
  }

  modifier onlyOwner {
    require(msg.sender == _owner, 'ProxyOwner: only owner');
    _;
  }

  function implementationOf(address proxy) external view returns (address) {
    (address admin, address impl) = IProxyView(proxy)._proxy_view_implementation();
    require(admin == address(this), 'proxy admin is different');
    return impl;
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
