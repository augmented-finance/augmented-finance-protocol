// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../interfaces/IRewardController.sol';
import './ControlledRewardPool.sol';

abstract contract BasePermitRewardPool is ControlledRewardPool {
  bytes public constant EIP712_REVISION = bytes('1');
  // solhint-disable-next-line var-name-mixedcase
  bytes32 public DOMAIN_SEPARATOR;
  // solhint-disable-next-line var-name-mixedcase
  bytes32 public CLAIM_TYPEHASH;

  bytes32 internal constant EIP712_DOMAIN =
    keccak256('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)');

  /// @dev spender => next valid nonce to submit with permit()
  mapping(address => uint256) public _nonces;

  string private _rewardPoolName;

  mapping(address => bool) private _providers;

  constructor(
    IRewardController controller,
    uint256 initialRate,
    uint16 baselinePercentage,
    string memory rewardPoolName
  ) ControlledRewardPool(controller, initialRate, baselinePercentage) {
    _rewardPoolName = rewardPoolName;

    _initializeDomainSeparator();
  }

  function _initialize(
    IRewardController controller,
    uint256 initialRate,
    uint16 baselinePercentage,
    string memory rewardPoolName
  ) internal {
    _rewardPoolName = rewardPoolName;
    _initializeDomainSeparator();
    super._initialize(controller, initialRate, baselinePercentage);
  }

  function _initializeDomainSeparator() internal {
    uint256 chainId;

    // solhint-disable-next-line no-inline-assembly
    assembly {
      chainId := chainid()
    }

    DOMAIN_SEPARATOR = keccak256(
      abi.encode(EIP712_DOMAIN, keccak256(bytes(_rewardPoolName)), keccak256(EIP712_REVISION), chainId, address(this))
    );
    CLAIM_TYPEHASH = getClaimTypeHash();
  }

  /// @dev returns nonce, to comply with eip-2612
  function nonces(address addr) external view returns (uint256) {
    return _nonces[addr];
  }

  function getPoolName() public view override returns (string memory) {
    return _rewardPoolName;
  }

  function availableReward() public view virtual returns (uint256);

  function getClaimTypeHash() internal pure virtual returns (bytes32);

  function addRewardProvider(address provider, address token) external override onlyConfigAdmin {
    require(provider != address(0), 'provider is required');
    require(token == address(0), 'token is unsupported');
    _providers[provider] = true;
    emit ProviderAdded(provider, token);
  }

  function removeRewardProvider(address provider) external override onlyConfigAdmin {
    delete (_providers[provider]);
    emit ProviderRemoved(provider);
  }

  function doClaimRewardByPermit(
    address provider,
    address spender,
    address to,
    uint256 value,
    uint256 at,
    bytes32 encodedHash,
    uint256 currentValidNonce,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) internal {
    require(provider != address(0) && _providers[provider], 'INVALID_PROVIDER');

    bytes32 digest = keccak256(abi.encodePacked('\x19\x01', DOMAIN_SEPARATOR, encodedHash));
    require(provider == ecrecover(digest, v, r, s), 'INVALID_SIGNATURE');

    _nonces[spender] = internalCheckNonce(currentValidNonce, at);

    if (value == 0) {
      return;
    }

    internalUpdateFunds(value);
    internalPushReward(to, value, uint32(block.timestamp));
  }

  function internalUpdateFunds(uint256 value) internal virtual;

  function internalCheckNonce(uint256 nonce, uint256 at) internal virtual returns (uint256);

  function internalPushReward(
    address holder,
    uint256 allocated,
    uint32 since
  ) internal virtual {
    internalAllocateReward(holder, allocated, since, AllocationMode.Push);
  }
}
