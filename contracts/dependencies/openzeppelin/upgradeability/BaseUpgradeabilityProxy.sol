// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

import './Proxy.sol';
import '../contracts/Address.sol';

contract BaseUpgradeabilityProxy is Proxy {
  /// @dev Emitted when the implementation is upgraded.
  event Upgraded(address indexed implementation);

  /// @dev Storage slot with the address of the current implementation.
  bytes32 internal constant IMPLEMENTATION_SLOT =
    0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;

  /// @dev Returns the current implementation.
  function _implementation() internal view override returns (address impl) {
    bytes32 slot = IMPLEMENTATION_SLOT;
    //solium-disable-next-line
    assembly {
      impl := sload(slot)
    }
  }

  /// @dev Upgrades the proxy to a new implementation.
  function _upgradeTo(address newImplementation) internal {
    _setImplementation(newImplementation);
    emit Upgraded(newImplementation);
  }

  /// @dev Sets the implementation address of the proxy.
  function _setImplementation(address newImplementation) internal {
    require(
      Address.isContract(newImplementation),
      'Cannot set a proxy implementation to a non-contract address'
    );

    bytes32 slot = IMPLEMENTATION_SLOT;

    //solium-disable-next-line
    assembly {
      sstore(slot, newImplementation)
    }
  }
}
