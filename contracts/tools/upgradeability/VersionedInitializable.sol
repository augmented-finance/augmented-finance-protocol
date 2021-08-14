// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

/**
 * @title VersionedInitializable
 *
 * @dev Helper contract to implement versioned initializer functions. To use it, replace
 * the constructor with a function that has the `initializer` or `initializerRunAlways` modifier.
 * The revision number should be defined as a private constant, returned by getRevision() and used by initializer() modifier.
 *
 * ATTN: There is a built-in protection from implementation self-destruct exploits. This protection
 * prevents initializers from being called on an implementation inself, but only on proxied contracts.
 * To override this protection, call _unsafeResetVersionedInitializers() from a constructor.
 *
 * WARNING: Unlike constructors, initializer functions must be manually
 * invoked. This applies both to deploying an initializable contract, as well
 * as extending an initializable contract via inheritance.
 *
 * ATTN: When used with inheritance, parent initializers with `initializer` modifier are prevented by calling twice,
 * but can only be called in child-to-parent sequence.
 *
 * WARNING: When used with inheritance, parent initializers with `initializerRunAlways` modifier
 * are NOT protected from multiple calls by another initializer.
 */
abstract contract VersionedInitializable {
  uint256 private constant BLOCK_REVISION = type(uint256).max;
  // This revision number is applied to implementations
  uint256 private constant IMPL_REVISION = BLOCK_REVISION - 1;

  /// @dev Indicates that the contract has been initialized. The default value blocks initializers from being called on an implementation.
  uint256 private lastInitializedRevision = IMPL_REVISION;

  /// @dev Indicates that the contract is in the process of being initialized.
  uint256 private lastInitializingRevision = 0;

  /**
   * @dev There is a built-in protection from self-destruct of implementation exploits. This protection
   * prevents initializers from being called on an implementation inself, but only on proxied contracts.
   * Function _unsafeResetVersionedInitializers() can be called from a constructor to disable this protection.
   * It must be called before any initializers, otherwise it will fail.
   */
  function _unsafeResetVersionedInitializers() internal {
    require(isConstructor(), 'only for constructor');

    if (lastInitializedRevision == IMPL_REVISION) {
      lastInitializedRevision = 0;
    } else {
      require(lastInitializedRevision == 0, 'can only be called before initializer(s)');
    }
  }

  /// @dev Modifier to use in the initializer function of a contract.
  modifier initializer(uint256 localRevision) {
    (uint256 topRevision, bool initializing, bool skip) = _preInitializer(localRevision);

    if (!skip) {
      lastInitializingRevision = localRevision;
      _;
      lastInitializedRevision = localRevision;
    }

    if (!initializing) {
      lastInitializedRevision = topRevision;
      lastInitializingRevision = 0;
    }
  }

  modifier initializerRunAlways(uint256 localRevision) {
    (uint256 topRevision, bool initializing, bool skip) = _preInitializer(localRevision);

    if (!skip) {
      lastInitializingRevision = localRevision;
    }
    _;
    if (!skip) {
      lastInitializedRevision = localRevision;
    }

    if (!initializing) {
      lastInitializedRevision = topRevision;
      lastInitializingRevision = 0;
    }
  }

  function _preInitializer(uint256 localRevision)
    private
    returns (
      uint256 topRevision,
      bool initializing,
      bool skip
    )
  {
    topRevision = getRevision();
    require(topRevision < IMPL_REVISION, 'invalid contract revision');

    require(localRevision > 0, 'incorrect initializer revision');
    require(localRevision <= topRevision, 'inconsistent contract revision');

    if (lastInitializedRevision < IMPL_REVISION) {
      // normal initialization
      initializing = lastInitializingRevision > 0 && lastInitializedRevision < topRevision;
      require(initializing || isConstructor() || topRevision > lastInitializedRevision, 'already initialized');
    } else {
      // by default, initialization of implementation is only allowed inside a constructor
      require(lastInitializedRevision == IMPL_REVISION && isConstructor(), 'initializer blocked');

      // enable normal use of initializers inside a constructor
      lastInitializedRevision = 0;
      // but make sure to block initializers afterwards
      topRevision = BLOCK_REVISION;

      initializing = lastInitializingRevision > 0;
    }

    if (initializing) {
      require(lastInitializingRevision > localRevision, 'incorrect order of initializers');
    }

    if (localRevision <= lastInitializedRevision) {
      // prevent calling of parent's initializer when it was called before
      if (initializing) {
        // Can't set zero yet, as it is not a top-level call, otherwise `initializing` will become false.
        // Further calls will fail with the `incorrect order` assertion above.
        lastInitializingRevision = 1;
      }
      return (topRevision, initializing, true);
    }
    return (topRevision, initializing, false);
  }

  function isRevisionInitialized(uint256 localRevision) internal view returns (bool) {
    return lastInitializedRevision >= localRevision;
  }

  // solhint-disable-next-line func-name-mixedcase
  function REVISION() public pure returns (uint256) {
    return getRevision();
  }

  /**
   * @dev returns the revision number (< type(uint256).max - 1) of the contract.
   * The number should be defined as a private constant.
   **/
  function getRevision() internal pure virtual returns (uint256);

  /// @dev Returns true if and only if the function is running in the constructor
  function isConstructor() private view returns (bool) {
    uint256 cs;
    // solhint-disable-next-line no-inline-assembly
    assembly {
      cs := extcodesize(address())
    }
    return cs == 0;
  }

  // Reserved storage space to allow for layout changes in the future.
  uint256[4] private ______gap;
}
