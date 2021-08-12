// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

/**
  @dev Represents a registry for referral codes
  There are 3 categories of codes:
  - short codes (refCode <= type(uint32).max) - can only be registred by an admin
  - default codes (will all 32 lower bits set to 1) - each address has a pre-owned ref code
  - custom codes - anything else

  An owner of a ref code can transfer it to another owner.
 */
interface IReferralRegistry {
  /// @dev registers an un-owned custom `refCode` code for `owner`. Reverts on an owned or non-custom code.
  function registerCustomCode(uint256 refCode, address owner) external;

  /// @dev returns a default ref code for the given address. Result wont change if the code was given away.
  function defaultCode(address addr) external view returns (uint256 refCode);

  /// @dev transfers the ref code to a new owner. Reverts when the caller is not a current owner.
  function transferCodeTo(uint256 refCode, address to) external;

  /// @dev returns timestamps (e.g. of the last reward claim) for the given `codes`.
  /// When the `owner` doesn't own a code, value of type(uint32).max is returned for such code.
  function timestampsOf(address owner, uint256[] calldata codes)
    external
    view
    returns (uint32[] memory timestamps);

  event RefCodeDelegated(uint256 indexed refCode, address from, address indexed to);
}
