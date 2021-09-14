// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

interface IAddressesProviderRegistry {
  event AddressesProviderPreparing(address indexed newAddress);
  event AddressesProviderRegistered(address indexed newAddress);
  event AddressesProviderUnregistered(address indexed newAddress);

  function getAddressesProvidersList() external view returns (address[] memory);

  function getAddressesProviderIdByAddress(address) external view returns (uint256);

  function prepareAddressesProvider(address provider) external;

  function registerAddressesProvider(address provider, uint256 id) external;

  function unregisterAddressesProvider(address provider) external;

  function setOneTimeRegistrar(address user, uint256 expectedId) external;

  function getOneTimeRegistrar() external view returns (address user, uint256 expectedId);

  function renounceOneTimeRegistrar() external;
}
