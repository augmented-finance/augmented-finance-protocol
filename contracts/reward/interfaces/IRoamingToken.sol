// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

interface IRoamingToken {
  struct RoamingData {
    uint256 allocatedSupply;
    uint256 sequence;
  }

  event BurnedToRoaming(address indexed sender, uint256 amount, uint256 indexed toNetworkId, RoamingData data);
  event MintedFromRoaming(address indexed receiver, uint256 amount, uint256 indexed fromNetworkId, RoamingData data);

  function burnToRoaming(
    address sender,
    uint256 amount,
    uint256 toNetworkId
  ) external returns (RoamingData memory);

  function mintFromRoaming(
    address receiver,
    uint256 amount,
    uint256 fromNetworkId,
    RoamingData calldata data
  ) external;

  function roamingSupply() external view returns (int256);
}
