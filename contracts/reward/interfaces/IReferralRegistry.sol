// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

interface IReferralRegistry {
  function registerCustomCode(uint32 refCode, address to) external;

  function defaultCode(address addr) external view returns (uint256 refCode);

  function delegateCodeTo(uint256 refCode, address to) external;

  function delegateDefaultCodeTo(address to) external returns (uint256 refCode);

  function timestampsOf(address owner, uint256[] calldata codes)
    external
    view
    returns (uint32[] memory timestamps);

  event RefCodeDelegated(uint256 indexed refCode, address from, address indexed to);
}
