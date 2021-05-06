// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {IERC20} from '../../dependencies/openzeppelin/contracts/IERC20.sol';
import {IERC20Detailed} from '../../dependencies/openzeppelin/contracts/IERC20Detailed.sol';
// import {VotingToken} from './VotingToken.sol';
import {StakeTokenBase} from './StakeTokenBase.sol';

import {AccessFlags} from '../../access/AccessFlags.sol';
import {StakeTokenConfig} from './interfaces/StakeTokenConfig.sol';
import {VersionedInitializable} from '../../tools/upgradeability/VersionedInitializable.sol';
import {
  IRemoteAccessBitmask,
  RemoteAccessBitmaskHelper
} from '../../access/interfaces/IRemoteAccessBitmask.sol';
import {IMarketAccessController} from '../../access/interfaces/IMarketAccessController.sol';

import {IRewardMinter} from '../../interfaces/IRewardMinter.sol';

/**
 * @title StakedAgfV1
 * @notice Staked AGF token
 **/
contract StakedAgfV1 is
  StakeTokenBase, // VotingToken,
  VersionedInitializable,
  IRewardMinter
{
  string internal constant NAME = 'Staked AGF';
  string internal constant SYMBOL = 'stkAGF';
  uint32 internal constant COOLDOWN_BLOCKS = 100;
  uint32 internal constant UNSTAKE_BLOCKS = 10;

  uint256 private constant TOKEN_REVISION = 1;

  constructor() public StakeTokenBase(zeroConfig(), NAME, SYMBOL, 0) {}

  function zeroConfig() private pure returns (StakeTokenConfig memory) {}

  // This initializer is invoked by AccessController.setAddressAsImpl
  function initialize(IMarketAccessController remoteAcl)
    external
    virtual
    initializerRunAlways(TOKEN_REVISION)
  {
    StakeTokenConfig memory params;

    params.stakeController = remoteAcl;
    params.stakedToken = IERC20(remoteAcl.getRewardToken());
    params.cooldownBlocks = COOLDOWN_BLOCKS;
    params.unstakeBlocks = UNSTAKE_BLOCKS;

    _initialize(params, NAME, SYMBOL, IERC20Detailed(address(params.stakedToken)).decimals());
  }

  function initialize(
    StakeTokenConfig calldata params,
    string calldata name,
    string calldata symbol,
    uint8 decimals
  ) external virtual override initializerRunAlways(TOKEN_REVISION) {
    _initialize(params, name, symbol, decimals);
  }

  function _initialize(
    StakeTokenConfig memory params,
    string memory name,
    string memory symbol,
    uint8 decimals
  ) private {
    super._initializeERC20(name, symbol, decimals);
    super._initializeToken(params);

    if (!isRevisionInitialized(TOKEN_REVISION)) {
      super._initializeDomainSeparator();
    }
    emit Initialized(params, name, symbol, decimals);
  }

  /**
   * @dev returns the revision of the implementation contract
   * @return The revision
   */
  function getRevision() internal pure virtual override returns (uint256) {
    return TOKEN_REVISION;
  }

  /**
   * @dev mints stake token on top of the underlying (reward) token. Reward token MUST be minted to AFTER this call.
   */
  function mintReward(address account, uint256 amount)
    external
    override
    aclHas(AccessFlags.REWARD_MINT)
    returns (IRewardMinter, address)
  {
    internalStake(msg.sender, account, amount, false);
    return (IRewardMinter(getUnderlying()), address(this));
  }
}
