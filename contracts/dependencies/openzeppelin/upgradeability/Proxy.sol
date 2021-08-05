// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

abstract contract Proxy {
  fallback() external payable {
    _fallback();
  }

  receive() external payable {
    _fallback();
  }

  /// @return The Address of the implementation.
  function _implementation() internal view virtual returns (address);

  /**
   * @dev Delegates execution to an implementation contract.
   * This is a low level function that doesn't return to its internal call site.
   * It will return to the external caller whatever the implementation returns.
   * @param implementation Address to delegate.
   */
  function _delegate(address implementation) internal {
    //solium-disable-next-line
    assembly {
      // Copy msg.data. We take full control of memory in this inline assembly
      // block because it will not return to Solidity code. We overwrite the
      // Solidity scratch pad at memory position 0.
      calldatacopy(0, 0, calldatasize())

      // Call the implementation.
      // out and outsize are 0 because we don't know the size yet.
      let result := delegatecall(gas(), implementation, 0, calldatasize(), 0, 0)

      // Copy the returned data.
      returndatacopy(0, 0, returndatasize())

      switch result
        // delegatecall returns 0 on error.
        case 0 {
          revert(0, returndatasize())
        }
        default {
          return(0, returndatasize())
        }
    }
  }

  /// @dev Function that is run as the first thing in the fallback function. Must call super._willFallback()
  function _willFallback() internal virtual {}

  /// @dev fallback implementation.
  function _fallback() internal {
    _willFallback();
    _delegate(_implementation());
  }
}
