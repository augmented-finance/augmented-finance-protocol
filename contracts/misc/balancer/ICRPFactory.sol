// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

interface ICRPFactory {
  event LogNewCrp(address indexed caller, address indexed pool);

  struct Rights {
    bool canPauseSwapping;
    bool canChangeSwapFee;
    bool canChangeWeights;
    bool canAddRemoveTokens;
    bool canWhitelistLPs;
    bool canChangeCap;
  }

  struct PoolParams {
    // Balancer Pool Token (representing shares of the pool)
    string poolTokenSymbol;
    string poolTokenName;
    // Tokens inside the Pool
    address[] constituentTokens;
    uint256[] tokenBalances;
    uint256[] tokenWeights;
    uint256 swapFee;
  }

  function newCrp(
    address factoryAddress,
    PoolParams calldata poolParams,
    Rights calldata rights,
    address smartPoolImplementation,
    address proxyAdmin
  ) external returns (address);

  function isCrp(address addr) external view returns (bool);
}
