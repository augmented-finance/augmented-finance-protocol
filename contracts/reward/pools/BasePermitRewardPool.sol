// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;

import {SafeMath} from '../../dependencies/openzeppelin/contracts/SafeMath.sol';
import {WadRayMath} from '../../tools/math/WadRayMath.sol';
import {IRewardController, AllocationMode} from '../interfaces/IRewardController.sol';
import {IManagedRewardPool} from '../interfaces/IManagedRewardPool.sol';
import {ControlledRewardPool} from './ControlledRewardPool.sol';

import 'hardhat/console.sol';

abstract contract BasePermitRewardPool is ControlledRewardPool {
  using SafeMath for uint256;
  using WadRayMath for uint256;

  bytes public constant EIP712_REVISION = bytes('1');
  bytes32 public DOMAIN_SEPARATOR;
  bytes32 internal constant EIP712_DOMAIN =
    keccak256('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)');
  bytes32 public CLAIM_TYPEHASH;

  /// @dev spender => next valid nonce to submit with permit()
  mapping(address => uint256) private _nonces;

  uint256 private _rewardLimit;
  string private _rewardPoolName;

  mapping(address => bool) private _providers;

  constructor(
    IRewardController controller,
    uint256 rewardLimit,
    string memory rewardPoolName
  ) public ControlledRewardPool(controller, 0, NO_SCALE, NO_BASELINE) {
    require(rewardLimit > 0, 'reward limit is required');
    _rewardLimit = rewardLimit;
    _rewardPoolName = rewardPoolName;

    uint256 chainId;

    //solium-disable-next-line
    assembly {
      chainId := chainid()
    }

    DOMAIN_SEPARATOR = keccak256(
      abi.encode(
        EIP712_DOMAIN,
        keccak256(bytes(_rewardPoolName)),
        keccak256(EIP712_REVISION),
        chainId,
        address(this)
      )
    );

    CLAIM_TYPEHASH = getClaimTypeHash();
  }

  function getClaimTypeHash() internal pure virtual returns (bytes32);

  function nonceOf(address spender) public view returns (uint256) {
    return _nonces[spender];
  }

  function stopRewards() external onlyController() {
    _rewardLimit = 0;
  }

  function internalGetReward(address, uint256) internal virtual override returns (uint256, uint32) {
    return (0, 0);
  }

  function internalCalcReward(address) internal view virtual override returns (uint256, uint32) {
    return (0, 0);
  }

  function addRewardProvider(address provider, address token) external override onlyController {
    require(provider != address(0), 'provider is required');
    require(token == address(0), 'token is unsupported');
    _providers[provider] = true;
  }

  function removeRewardProvider(address provider) external override onlyController {
    delete (_providers[provider]);
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
    require(provider != address(0), 'INVALID_PROVIDER');
    require(_providers[provider], 'INVALID_PROVIDER');
    require(_rewardLimit >= value, 'INSUFFICIENT_FUNDS');
    bytes32 digest = keccak256(abi.encodePacked('\x19\x01', DOMAIN_SEPARATOR, encodedHash));

    require(provider == ecrecover(digest, v, r, s), 'INVALID_SIGNATURE');

    _nonces[spender] = internalCheckNonce(currentValidNonce, at);
    if (value == 0) {
      return;
    }
    _rewardLimit = _rewardLimit.sub(value, 'insufficient reward pool balance');
    internalPushReward(to, value, uint32(block.timestamp));
  }

  function internalCheckNonce(uint256 nonce, uint256 at) internal virtual returns (uint256);

  function internalPushReward(
    address holder,
    uint256 allocated,
    uint32 since
  ) internal virtual {
    internalAllocateReward(holder, allocated, since, AllocationMode.Push);
  }

  function internalSetBaselinePercentage(uint16) internal override {
    revert('NOT_SUPPORTED');
  }

  function internalSetRate(uint256) internal override {}

  function internalGetRate() internal view override returns (uint256) {
    return 0;
  }
}
