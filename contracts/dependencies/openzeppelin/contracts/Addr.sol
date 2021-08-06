// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

/// @dev Extracted from Address.sol to fit into the verification limit
library Addr {
  function isContract(address account) internal view returns (bool) {
    uint256 size;
    assembly {
      size := extcodesize(account)
    }
    return size > 0;
  }
}
