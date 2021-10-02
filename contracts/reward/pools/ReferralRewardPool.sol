// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../interfaces/IRewardController.sol';
import '../referral/BaseReferralRegistry.sol';
import '../calcs/CalcLinearRewardAccum.sol';
import './BasePermitRewardPool.sol';

contract ReferralRewardPool is BasePermitRewardPool, BaseReferralRegistry, CalcLinearRewardAccum {
  event RewardClaimedByPermit(address indexed provider, address indexed spender, uint256 value, uint256 since);

  constructor(
    IRewardController controller,
    uint256 initialRate,
    uint16 baselinePercentage,
    string memory rewardPoolName
  ) ControlledRewardPool(controller, initialRate, baselinePercentage) BasePermitRewardPool(rewardPoolName) {}

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
    require(uint32(issuedAt) == issuedAt);

    bytes32 encodedHash = keccak256(
      abi.encode(CLAIM_TYPEHASH, provider, spender, value, currentValidNonce, issuedAt, codes)
    );

    doClaimRewardByPermit(provider, spender, spender, value, issuedAt, encodedHash, currentValidNonce, v, r, s);

    internalUpdateStrict(spender, codes, uint32(issuedAt));
    emit RewardClaimedByPermit(provider, spender, value, currentValidNonce);
  }

  function internalCheckNonce(uint256, uint256 issuedAt) internal pure override returns (uint256) {
    return issuedAt;
  }

  function internalUpdateFunds(uint256 value) internal override {
    doGetReward(value);
  }

  function availableReward() public view override returns (uint256) {
    return doCalcReward();
  }

  function registerShortCode(uint32 shortRefCode, address to) external onlyRefAdmin {
    internalRegisterCode(shortRefCode, to);
  }

  function registerShortCodes(uint32[] calldata shortRefCode, address[] calldata to) external onlyRefAdmin {
    require(shortRefCode.length == to.length);
    for (uint256 i = 0; i < to.length; i++) {
      internalRegisterCode(shortRefCode[i], to[i]);
    }
  }

  function internalSetRate(uint256 rate) internal override {
    super.setLinearRate(rate);
  }

  function internalGetRate() internal view override returns (uint256) {
    return super.getLinearRate();
  }

  function getCurrentTick() internal view override returns (uint32) {
    return uint32(block.timestamp);
  }

  function internalGetReward(address)
    internal
    virtual
    override
    returns (
      uint256,
      uint32,
      bool
    )
  {
    return (0, 0, false);
  }

  function internalCalcReward(address, uint32) internal view virtual override returns (uint256, uint32) {
    return (0, 0);
  }

  function _onlyRefAdmin() private view {
    AccessHelper.requireAnyOf(
      getAccessController(),
      msg.sender,
      AccessFlags.REFERRAL_ADMIN,
      Errors.CALLER_NOT_REF_ADMIN
    );
  }

  modifier onlyRefAdmin() {
    _onlyRefAdmin();
    _;
  }
}
