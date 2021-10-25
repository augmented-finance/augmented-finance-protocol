// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

interface IRoamingToken {
  event BurnedToRoaming(address indexed sender, uint256 amount, uint256 indexed toNetworkId, bytes roamingData);
  event MintedFromRoaming(address indexed receiver, uint256 amount, uint256 indexed fromNetworkId, bytes roamingData);

  function burnToRoaming(
    address sender,
    uint256 amount,
    uint256 toNetworkId
  ) external returns (bytes memory roamingData);

  function mintFromRoaming(
    address receiver,
    uint256 amount,
    uint256 fromNetworkId,
    bytes calldata roamingData
  ) external;

  function roamingSupply() external view returns (int256);
}
