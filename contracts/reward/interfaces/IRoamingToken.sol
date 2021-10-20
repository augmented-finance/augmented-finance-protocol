// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

interface IRoamingToken {
  struct RoamingData {
    uint256 amount;
    uint256 allocatedSupply;
    uint256 fromChainId;
    uint256 sequence;
  }

  event BurnedToRoaming(address indexed sender, uint256 amount, RoamingData data);
  event MintedFromRoaming(address indexed receiver, uint256 amount, RoamingData data);

  function burnToRoaming(address sender, uint256 amount) external returns (RoamingData memory);

  function mintFromRoaming(address receiver, RoamingData calldata data) external;

  function roamingSupply() external view returns (int256);
}
