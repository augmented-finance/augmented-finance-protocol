// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {IERC20} from '../../dependencies/openzeppelin/contracts/IERC20.sol';

import {SafeERC20} from '../../dependencies/openzeppelin/contracts/SafeERC20.sol';
import {SafeMath} from '../../dependencies/openzeppelin/contracts/SafeMath.sol';
import {WadRayMath} from '../../tools/math/WadRayMath.sol';

import {AccessFlags} from '../../access/AccessFlags.sol';
import {MarketAccessBitmask} from '../../access/MarketAccessBitmask.sol';
import {IMarketAccessController} from '../../access/interfaces/IMarketAccessController.sol';

import {ForwardedRewardPool} from '../pools/ForwardedRewardPool.sol';
import {CalcLinearRateReward} from '../calcs/CalcLinearRateReward.sol';

import {Errors} from '../../tools/Errors.sol';

import 'hardhat/console.sol';

abstract contract BaseReferralRegistry {
  using SafeMath for uint256;
  using WadRayMath for uint256;
  using SafeERC20 for IERC20;

  mapping(uint256 => address) _delegations;
  mapping(uint256 => uint32) _timestamps;

  uint32 public constant MAX_SHORT_CODE = type(uint32).max;

  function internalRegisterShortCode(uint32 shortRefCode, address to) internal {
    require(shortRefCode != 0);
    require(to != address(0));
    require(_delegations[shortRefCode] == address(0));

    _delegations[shortRefCode] = to;
  }

  function defaultCode(address addr) public pure returns (uint256) {
    if (addr == address(0)) {
      return 0;
    }
    return uint256(keccak256(abi.encodePacked(addr))) << 32;
  }

  function delegateCodeTo(uint256 refCode, address to) public {
    require(refCode != 0);
    require(to != address(0));
    require(_delegations[refCode] == msg.sender);
    _delegations[refCode] = to;
  }

  function delegateDefaultCodeTo(address to) public {
    delegateCodeTo(defaultCode(msg.sender), to);
  }

  function timestampsOf(address owner, uint256[] calldata codes)
    external
    view
    returns (uint32[] memory timestamps)
  {
    require(owner != address(0));

    timestamps = new uint32[](codes.length);
    for (uint256 i = 0; i < codes.length; i++) {
      if (_delegations[codes[i]] != owner) {
        timestamps[i] = type(uint32).max;
        continue;
      }

      timestamps[i] = _timestamps[codes[i]];
    }

    return timestamps;
  }

  function internalUpdateTimestamps(
    address owner,
    uint256[] calldata codes,
    uint32 current
  ) internal returns (uint32[] memory timestamps) {
    require(owner != address(0));

    timestamps = new uint32[](codes.length);
    for (uint256 i = 0; i < codes.length; i++) {
      if (_delegations[codes[i]] != owner) {
        timestamps[i] = type(uint32).max;
        continue;
      }

      timestamps[i] = _timestamps[codes[i]];

      if (_timestamps[codes[i]] < current) {
        _timestamps[codes[i]] = current;
      }
    }

    return timestamps;
  }

  function internalUpdateStrict(
    address owner,
    uint256[] calldata codes,
    uint32 current
  ) internal {
    require(owner != address(0));

    for (uint256 i = 0; i < codes.length; i++) {
      require(_delegations[codes[i]] == owner, 'INVALID_CODE_OWNER');
      require(_timestamps[codes[i]] < current, 'INVALID_CODE_TIMESTAMP');

      _timestamps[codes[i]] = current;
    }
  }
}
