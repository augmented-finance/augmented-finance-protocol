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
    StakeToken(zeroConfig(), NAME, SYMBOL, 18)
  //    VotingToken(zeroConfig(), NAME, SYMBOL, 18)
  {

  }

  function zeroConfig() private pure returns (StakeTokenConfig memory) {}

  function initialize(
    StakeTokenConfig calldata params,
    string calldata name,
    string calldata symbol,
    uint8 decimals
  ) external virtual override initializerRunAlways(TOKEN_REVISION) {
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
}
