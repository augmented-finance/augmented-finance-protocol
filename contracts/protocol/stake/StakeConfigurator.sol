// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {IERC20} from '../../dependencies/openzeppelin/contracts/IERC20.sol';
import {IERC20Details} from '../../dependencies/openzeppelin/contracts/IERC20Details.sol';
import {VersionedInitializable} from '../../tools/upgradeability/VersionedInitializable.sol';
import {IMarketAccessController} from '../../access/interfaces/IMarketAccessController.sol';
import {IDerivedToken} from '../../interfaces/IDerivedToken.sol';
import {MarketAccessBitmask} from '../../access/MarketAccessBitmask.sol';
import {Errors} from '../../tools/Errors.sol';
import {IStakeConfigurator} from './interfaces/IStakeConfigurator.sol';
import {IInitializableStakeToken} from './interfaces/IInitializableStakeToken.sol';
import {StakeTokenConfig} from './interfaces/StakeTokenConfig.sol';
import {IProxy} from '../../tools/upgradeability/IProxy.sol';
import {AccessFlags} from '../../access/AccessFlags.sol';

contract StakeConfigurator is MarketAccessBitmask, VersionedInitializable, IStakeConfigurator {
  uint256 private constant CONFIGURATOR_REVISION = 1;

  struct TokenEntry {
    address token;
  }

  mapping(uint256 => TokenEntry) private _entries;
  uint256 private _entryCount;
  mapping(address => uint256) private _underlyings;

  StakeConfiguratorBypass private immutable _bypass;

  constructor() public MarketAccessBitmask(IMarketAccessController(0)) {
    _bypass = new StakeConfiguratorBypass();
  }

  function getRevision() internal pure virtual override returns (uint256) {
    return CONFIGURATOR_REVISION;
  }

  // This initializer is invoked by AccessController.setAddressAsImpl
  function initialize(address addressesProvider) external initializer(CONFIGURATOR_REVISION) {
    _remoteAcl = IMarketAccessController(addressesProvider);
  }

  function list() public view returns (address[] memory tokens, uint256 count) {
    if (_entryCount == 0) {
      return (tokens, 0);
    }
    tokens = new address[](_entryCount);
    for (uint256 i = 1; i <= _entryCount; i++) {
      tokens[count] = _entries[i].token;
      if (tokens[count] != address(0)) {
        count++;
      }
    }
    return (tokens, count);
  }

  function stakeTokenOf(address underlying) public view returns (address) {
    uint256 i = _underlyings[underlying];
    if (i == 0) {
      return address(0);
    }
    return _entries[i].token;
  }

  function dataOf(address stakeToken) public view returns (StakeTokenData memory data) {
    return _bypass.dataOf(stakeToken);
  }

  function getStakeTokensData()
    public
    view
    returns (StakeTokenData[] memory dataList, uint256 count)
  {
    if (_entryCount == 0) {
      return (dataList, 0);
    }
    dataList = new StakeTokenData[](_entryCount);
    for (uint256 i = 1; i <= _entryCount; i++) {
      address token = _entries[i].token;
      if (token == address(0)) {
        continue;
      }
      dataList[count] = dataOf(token);
      count++;
    }
    return (dataList, count);
  }

  function addStakeToken(address token) public aclHas(AccessFlags.STAKE_ADMIN) {
    require(token != address(0), 'unknown token');
    _addStakeToken(token, IDerivedToken(token).UNDERLYING_ASSET_ADDRESS());
  }

  function removeStakeTokenByUnderlying(address underlying)
    public
    aclHas(AccessFlags.STAKE_ADMIN)
    returns (bool)
  {
    require(underlying != address(0), 'unknown underlying');
    uint256 i = _underlyings[underlying];
    if (i == 0) {
      return false;
    }
    delete (_underlyings[underlying]);
    delete (_entries[i]);
    return true;
  }

  function _addStakeToken(address token, address underlying) private {
    require(token != address(0), 'unknown token');
    require(underlying != address(0), 'unknown underlying');
    require(stakeTokenOf(underlying) == address(0), 'ambiguous underlying');
    uint256 i = _entryCount + 1;
    _entryCount = i;

    _entries[i] = TokenEntry(token);
    _underlyings[underlying] = i;
  }

  function batchInitStakeTokens(InitStakeTokenData[] memory input)
    public
    aclHas(AccessFlags.STAKE_ADMIN)
  {
    for (uint256 i = 0; i < input.length; i++) {
      initStakeToken(input[i]);
    }
  }

  function initStakeToken(InitStakeTokenData memory input) private returns (address token) {
    StakeTokenConfig memory config =
      StakeTokenConfig(
        _remoteAcl,
        IERC20(input.stakedToken),
        input.cooldownPeriod,
        input.unstakePeriod,
        input.maxSlashable
      );

    bytes memory params =
      abi.encodeWithSelector(
        IInitializableStakeToken.initialize.selector,
        config,
        input.stkTokenName,
        input.stkTokenSymbol,
        input.stkTokenDecimals
      );

    token = address(_remoteAcl.createProxy(address(this), input.stakeTokenImpl, params));
    dataOf(token);
    _addStakeToken(token, input.stakedToken);
    // TODO: emit StakeTokenInitialized(...);
    return token;
  }

  function updateStakeToken(UpdateStakeTokenData calldata input)
    external
    aclHas(AccessFlags.STAKE_ADMIN)
  {
    StakeTokenData memory data = dataOf(input.token);

    bytes memory params =
      abi.encodeWithSelector(
        IInitializableStakeToken.initialize.selector,
        data.config,
        input.stkTokenName,
        input.stkTokenSymbol,
        data.stkTokenDecimals
      );

    IProxy(input.token).upgradeToAndCall(input.stakeTokenImpl, params);

    // TODO: emit StakeTokenUpgraded(...);
  }
}

contract StakeConfiguratorBypass {
  function dataOf(address stakeToken)
    public
    view
    returns (IStakeConfigurator.StakeTokenData memory data)
  {
    (
      data.config,
      data.stkTokenName,
      data.stkTokenSymbol,
      data.stkTokenDecimals
    ) = IInitializableStakeToken(stakeToken).initializedWith();
    data.token = stakeToken;

    return data;
  }
}
