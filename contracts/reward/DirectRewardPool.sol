// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.12;

import {SafeMath} from '../dependencies/openzeppelin/contracts/SafeMath.sol';
import {WadRayMath} from '../tools/math/WadRayMath.sol';
import {AccessBitmask} from '../misc/AccessBitmask.sol';
import {IRewardController} from './IRewardController.sol';
import {IManagedRewardPool} from './IRewardPool.sol';

import 'hardhat/console.sol';

contract DirectRewardPool is AccessBitmask, IManagedRewardPool {
  using SafeMath for uint256;
  using WadRayMath for uint256;

  uint256 constant aclConfigure = 1 << 1;
  uint256 constant aclProvider = 1 << 2;

  bytes32 public DOMAIN_SEPARATOR;
  bytes public constant EIP712_REVISION = bytes('1');
  bytes32 internal constant EIP712_DOMAIN =
    keccak256('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)');
  bytes32 public constant CLAIM_TYPEHASH =
    keccak256(
      'ClaimReward(address provider,address spender,uint256 value,uint256 nonce,uint256 deadline)'
    );

  /// @dev spender => next valid nonce to submit with permit()
  mapping(address => uint256) public _nonces;

  IRewardController private _controller;
  uint256 private _rewardLimit;
  string private _rewardPoolName;

  constructor(
    IRewardController controller,
    uint256 rewardLimit,
    string memory rewardPoolName
  ) public {
    require(address(controller) != address(0), 'controller is required');
    require(rewardLimit > 0, 'reward limit is required');
    _controller = controller;
    _rewardLimit = rewardLimit;
    _rewardPoolName = rewardPoolName;
    _grantAcl(msg.sender, aclConfigure);
    _grantAcl(address(controller), aclConfigure);

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
  }

  function isLazy() external view override returns (bool) {
    return false;
  }

  function admin_stopRewards() external aclHas(aclConfigure) {
    _rewardLimit = 0;
  }

  function setRate(uint256 rate) external override aclHas(aclConfigure) {}

  function claimRewardOnBehalf(address) external override onlyController returns (uint256) {
    return 0;
  }

  function calcRewardOnBehalf(address) external view override onlyController returns (uint256) {
    return 0;
  }

  function addRewardProvider(address provider) external override aclHas(aclConfigure) {
    _grantAcl(provider, aclProvider);
  }

  function removeRewardProvider(address provider) external override aclHas(aclConfigure) {
    _revokeAcl(provider, aclProvider);
  }

  function claimRewardByPermit(
    address provider,
    address spender,
    uint256 value,
    uint256 deadline,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) external {
    require(provider != address(0), 'INVALID_PROVIDER');
    require(_getAcl(provider) & aclProvider == aclProvider, 'INVALID_PROVIDER');
    require(block.timestamp <= deadline, 'INVALID_EXPIRATION');
    require(_rewardLimit >= value, 'INSUFFICIENT_FUNDS');
    uint256 currentValidNonce = _nonces[spender];
    bytes32 digest =
      keccak256(
        abi.encodePacked(
          '\x19\x01',
          DOMAIN_SEPARATOR,
          keccak256(
            abi.encode(CLAIM_TYPEHASH, provider, spender, value, currentValidNonce, deadline)
          )
        )
      );

    require(provider == ecrecover(digest, v, r, s), 'INVALID_SIGNATURE');
    _nonces[spender] = currentValidNonce.add(1);

    if (value == 0) {
      return;
    }
    _rewardLimit = _rewardLimit.sub(value);
    _controller.allocatedByPool(spender, value);
  }

  modifier onlyController() {
    require(msg.sender == address(_controller), 'only controller is allowed');
    _;
  }
}
