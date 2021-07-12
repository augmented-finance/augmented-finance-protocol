// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;

import {SafeMath} from '../../dependencies/openzeppelin/contracts/SafeMath.sol';
import {WadRayMath} from '../../tools/math/WadRayMath.sol';
import {IRewardController, AllocationMode} from '../interfaces/IRewardController.sol';
import {IManagedRewardPool} from '../interfaces/IManagedRewardPool.sol';
import {BasePermitRewardPool} from './BasePermitRewardPool.sol';
import {BaseReferralRegistry} from '../referral/BaseReferralRegistry.sol';

import 'hardhat/console.sol';

contract ReferralRewardPool is BasePermitRewardPool, BaseReferralRegistry {
  uint256 private _claimLimit;

  constructor(
    IRewardController controller,
    uint256 rewardLimit,
    uint256 claimLimit,
    string memory rewardPoolName
  ) public BasePermitRewardPool(controller, rewardLimit, rewardPoolName) {
    _claimLimit = claimLimit;
  }

  function getClaimTypeHash() internal pure override returns (bytes32) {
    return
      keccak256(
        'ClaimReward(address provider,address spender,uint256 value,uint256 nonce,uint256 issuedAt,uint256[] codes)'
      );
  }

  function claimRewardByPermit(
    address provider,
    address spender,
    uint256 value,
    uint256 issuedAt,
    uint256[] calldata codes,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) external notPaused {
    uint256 currentValidNonce = _nonces[spender];
    require(issuedAt > currentValidNonce, 'EXPIRED_ISSUANCE');
    require(value > _claimLimit, 'EXCESSIVE_VALUE');
    require(uint32(issuedAt) == issuedAt);

    bytes32 encodedHash =
      keccak256(
        abi.encode(CLAIM_TYPEHASH, provider, spender, value, currentValidNonce, issuedAt, codes)
      );

    doClaimRewardByPermit(
      provider,
      spender,
      spender,
      value,
      issuedAt,
      encodedHash,
      currentValidNonce,
      v,
      r,
      s
    );

    internalUpdateStrict(spender, codes, uint32(issuedAt));
  }

  function internalCheckNonce(uint256, uint256 issuedAt) internal override returns (uint256) {
    return issuedAt;
  }

  function registerShortCode(uint32 shortRefCode, address to) public onlyRefAdmin {
    internalRegisterCode(shortRefCode, to);
  }
}
