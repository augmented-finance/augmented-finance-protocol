// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {VotingToken} from './VotingToken.sol';
import {StakeToken} from './StakeToken.sol';

import {StakeTokenConfig} from './interfaces/StakeTokenConfig.sol';
import {VersionedInitializable} from '../../tools/upgradeability/VersionedInitializable.sol';

/**
 * @title StakedAgfV1
 * @notice Staked AGF token
 **/
contract StakedAgfV1 is
  StakeToken,
  // VotingToken,
  VersionedInitializable
{
  string internal constant NAME = 'Staked AGF';
  string internal constant SYMBOL = 'stkAGF';

  uint256 private constant TOKEN_REVISION = 1;

  constructor()
    public
    StakeToken(zeroConfig(), NAME, SYMBOL)
  //    VotingToken(zeroConfig(), NAME, SYMBOL)
  {

  }

  function zeroConfig() private pure returns (StakeTokenConfig memory) {}

  function initialize(
    StakeTokenConfig calldata params,
    string calldata name,
    string calldata symbol
  ) external override initializerRunAlways(TOKEN_REVISION) {
    super._initializeERC20(name, symbol);
    super._initializeToken(params);

    if (!isRevisionInitialized(TOKEN_REVISION)) {
      super._initializeDomainSeparator();
    }
  }

  /**
   * @dev returns the revision of the implementation contract
   * @return The revision
   */
  function getRevision() internal pure override returns (uint256) {
    return TOKEN_REVISION;
  }
}
