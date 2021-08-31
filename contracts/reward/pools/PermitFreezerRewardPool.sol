// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../../dependencies/openzeppelin/contracts/SafeMath.sol';
import '../../tools/Errors.sol';
import '../interfaces/IRewardController.sol';
import '../calcs/CalcLinearFreezer.sol';
import './BasePermitRewardPool.sol';

contract PermitFreezerRewardPool is BasePermitRewardPool, CalcLinearFreezer {
  uint256 private _rewardLimit;

  event RewardClaimedByPermit(address indexed provider, address indexed spender, uint256 value, uint256 nonce);

  constructor(
    IRewardController controller,
    uint256 rewardLimit,
    uint32 meltDownAt,
    string memory rewardPoolName
  ) ControlledRewardPool(controller, 0, NO_BASELINE) BasePermitRewardPool(rewardPoolName) {
    _rewardLimit = rewardLimit;
    internalSetMeltDownAt(meltDownAt);
  }

  function getClaimTypeHash() internal pure override returns (bytes32) {
    return keccak256('ClaimReward(address provider,address spender,uint256 value,uint256 nonce,uint256 deadline)');
  }

  function setFreezePercentage(uint16 freezePortion) external onlyConfigAdmin {
    internalSetFreezePercentage(freezePortion);
  }

  function setMeltDownAt(uint32 at) external onlyConfigAdmin {
    internalSetMeltDownAt(at);
  }

  function availableReward() public view override returns (uint256) {
    return _rewardLimit;
  }

  function claimRewardByPermit(
    address provider,
    address spender,
    uint256 value,
    uint256 deadline,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) external notPaused {
    uint256 currentValidNonce = _nonces[spender];

    bytes32 encodedHash = keccak256(abi.encode(CLAIM_TYPEHASH, provider, spender, value, currentValidNonce, deadline));

    doClaimRewardByPermit(provider, spender, spender, value, deadline, encodedHash, currentValidNonce, v, r, s);
    emit RewardClaimedByPermit(provider, spender, value, currentValidNonce);
  }

  function internalCheckNonce(uint256 currentValidNonce, uint256 deadline) internal view override returns (uint256) {
    require(block.timestamp <= deadline, 'INVALID_EXPIRATION');
    return currentValidNonce + 1;
  }

  function internalGetReward(address holder, uint256) internal override returns (uint256 allocated, uint32) {
    (allocated, ) = doClaimByPull(holder, 0, 0);
    if (allocated == 0 && internalGetFrozenReward(holder) == 0) {
      internalAllocateReward(holder, 0, uint32(block.timestamp), AllocationMode.UnsetPull);
    }
    return (allocated, uint32(block.timestamp));
  }

  function internalCalcReward(address holder, uint32 at) internal view override returns (uint256 allocated, uint32) {
    (allocated, ) = doCalcByPull(holder, 0, 0, at, false);
    return (allocated, uint32(block.timestamp));
  }

  function internalPushReward(
    address holder,
    uint256 allocated,
    uint32 since
  ) internal override {
    AllocationMode mode;
    (allocated, since, mode) = doAllocatedByPush(holder, allocated, since);

    if (allocated == 0 && mode == AllocationMode.Push) {
      return;
    }
    internalAllocateReward(holder, allocated, since, mode);
  }

  function calcRewardFor(address holder, uint32 at)
    external
    view
    override
    returns (
      uint256 amount,
      uint256,
      uint32 since
    )
  {
    require(at >= uint32(block.timestamp));
    (amount, since) = internalCalcReward(holder, at);
    return (amount, internalGetFrozenReward(holder), since);
  }

  function internalUpdateFunds(uint256 value) internal override {
    _rewardLimit = SafeMath.sub(_rewardLimit, value, Errors.VL_INSUFFICIENT_REWARD_AVAILABLE);
  }

  function _setBaselinePercentage(uint16) internal pure override {
    revert('UNSUPPORTED');
  }

  function internalSetRate(uint256 rate) internal pure override {
    if (rate != 0) {
      revert('UNSUPPORTED');
    }
  }

  function internalGetRate() internal pure override returns (uint256) {
    return 0;
  }
}
