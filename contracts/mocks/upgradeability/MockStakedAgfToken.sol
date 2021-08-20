// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../../protocol/stake/SlashableStakeTokenBase.sol';
import '../../access/AccessFlags.sol';
import '../../protocol/stake/interfaces/StakeTokenConfig.sol';
import '../../tools/upgradeability/VersionedInitializable.sol';

contract MockStakedAgfToken is SlashableStakeTokenBase, VersionedInitializable {
  string internal constant NAME = 'Staked AGF mock';
  string internal constant SYMBOL = 'stkAGF';
  uint32 internal constant COOLDOWN_BLOCKS = 100;
  uint32 internal constant UNSTAKE_BLOCKS = 10;

  uint256 private constant TOKEN_REVISION = 1;

  constructor() SlashableStakeTokenBase(zeroConfig(), NAME, SYMBOL, 0) {
    // enables use of this instance without a proxy
    _unsafeResetVersionedInitializers();
  }

  function zeroConfig() private pure returns (StakeTokenConfig memory) {}

  function initializeStakeToken(
    StakeTokenConfig calldata params,
    string calldata name,
    string calldata symbol
  ) external override initializer(TOKEN_REVISION) {
    super._initializeERC20(name, symbol, params.stakedTokenDecimals);
    super._initializeToken(params);
    super._initializeDomainSeparator();
    emit Initialized(params, name, symbol);
  }

  /**
   * @dev returns the revision of the implementation contract
   * @return The revision
   */
  function getRevision() internal pure virtual override returns (uint256) {
    return TOKEN_REVISION;
  }
}
