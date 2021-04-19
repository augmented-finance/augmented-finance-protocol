// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.12;

import {Ownable} from '../dependencies/openzeppelin/contracts/Ownable.sol';
import {SafeMath} from '../dependencies/openzeppelin/contracts/SafeMath.sol';
import {Context} from '../dependencies/openzeppelin/contracts/Context.sol';
import {ERC20WithPermit} from '../misc/ERC20WithPermit.sol';
import {BitUtils} from '../tools/math/BitUtils.sol';
import {AccessFlags} from '../access/AccessFlags.sol';
import {RemoteAccessBitmask} from '../access/RemoteAccessBitmask.sol';
import {IRemoteAccessBitmask} from '../interfaces/IRemoteAccessBitmask.sol';

import {IRewardMinter} from './IRewardMinter.sol';

import 'hardhat/console.sol';

contract AGFToken is ERC20WithPermit, RemoteAccessBitmask, IRewardMinter {
  using BitUtils for uint256;

  constructor(
    IRemoteAccessBitmask remoteAcl,
    string memory name,
    string memory symbol
  ) public ERC20WithPermit(name, symbol) RemoteAccessBitmask(remoteAcl) {}

  function mint(address account, uint256 amount)
    external
    override
    aclHas(AccessFlags.ACL_AGF_MINT)
  {
    _mint(account, amount);
  }

  function burn(address account, uint256 amount) external aclHas(AccessFlags.ACL_AGF_BURN) {
    _burn(account, amount);
  }

  function _beforeTokenTransfer(
    address from,
    address to,
    uint256
  ) internal virtual override {
    require(
      _getRemoteAcl(from).hasNoneOf(AccessFlags.ACL_AGF_SUSPEND_ADDRESS),
      'sender is suspended'
    );
    require(
      _getRemoteAcl(to).hasNoneOf(AccessFlags.ACL_AGF_SUSPEND_ADDRESS),
      'receiver is suspended'
    );
  }
}
