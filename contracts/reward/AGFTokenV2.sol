// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../access/AccessFlags.sol';
import '../access/MarketAccessBitmask.sol';
import '../access/AccessHelper.sol';
import '../access/interfaces/IMarketAccessController.sol';
import '../tools/tokens/ERC20BaseWithPermit.sol';
import './interfaces/IRoamingToken.sol';
import './AGFTokenV1.sol';

contract AGFTokenV2 is AGFTokenV1, IRoamingToken {
  uint256 private constant TOKEN_REVISION = 2;

  int256 private _roamingSupply;
  uint256 private _sequence;

  function getRevision() internal pure virtual override returns (uint256) {
    return TOKEN_REVISION;
  }

  function burnToRoaming(address sender, uint256 amount)
    external
    override
    aclHas(AccessFlags.REWARD_BRIDGE)
    returns (RoamingData memory result)
  {
    require(amount > 0 && amount <= uint256(type(int256).max), 'INVALID_AMOUNT');

    uint256 chainId;
    // solhint-disable-next-line no-inline-assembly
    assembly {
      chainId := chainid()
    }

    _burn(sender, amount);
    _roamingSupply -= int256(amount);

    result = RoamingData(amount, allocatedSupply(), chainId, ++_sequence);
    emit BurnedToRoaming(sender, amount, result);
    return result;
  }

  function mintFromRoaming(address receiver, RoamingData calldata data)
    external
    override
    aclHas(AccessFlags.REWARD_BRIDGE)
  {
    require(data.amount > 0 && data.amount <= uint256(type(int256).max), 'INVALID_AMOUNT');
    _mintReward(receiver, data.amount);
    _roamingSupply += int256(data.amount);
    emit MintedFromRoaming(receiver, data.amount, data);
  }

  function roamingSupply() external view override returns (int256) {
    return _roamingSupply;
  }
}
