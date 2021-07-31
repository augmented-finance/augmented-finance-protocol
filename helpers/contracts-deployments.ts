import { BigNumberish, Contract } from 'ethers';
import { DRE, getContractFactory, getFirstSigner } from './misc-utils';
import {
  tEthereumAddress,
  eContractid,
  tStringTokenSmallUnits,
  LendingPools,
  TokenContractId,
  iMultiPoolsAssets,
  IReserveParams,
  PoolConfiguration,
} from './types';
import { MockContract } from 'ethereum-waffle';
import { getReservesConfigByPool } from './configuration';
import { ZERO_ADDRESS } from './constants';
import {
  MarketAccessControllerFactory,
  MintableERC20,
  RewardBoosterFactory,
  RewardConfiguratorFactory,
  StakeTokenFactory,
  TreasuryFactory,
  XAGFTokenV1Factory,
  ProtocolDataProviderFactory,
  DepositTokenFactory,
  AGFTokenV1Factory,
  OracleRouterFactory,
  DefaultReserveInterestRateStrategyFactory,
  DelegationAwareDepositTokenFactory,
  AddressesProviderRegistryFactory,
  LendingPoolCollateralManagerFactory,
  LendingPoolConfiguratorFactory,
  LendingPoolFactory,
  LendingRateOracleFactory,
  MintableDelegationERC20Factory,
  MintableERC20Factory,
  MockAggregatorFactory,
  MockDepositTokenFactory,
  MockAgfTokenFactory,
  MockStakedAgfTokenFactory,
  MockFlashLoanReceiverFactory,
  MockStableDebtTokenFactory,
  MockVariableDebtTokenFactory,
  MockUniswapV2Router02Factory,
  MockPriceOracleFactory,
  ReserveLogicFactory,
  SelfdestructTransferFactory,
  StableDebtTokenFactory,
  UniswapLiquiditySwapAdapterFactory,
  UniswapRepayAdapterFactory,
  VariableDebtTokenFactory,
  WETH9MockedFactory,
  WETHGatewayFactory,
  FlashLiquidationAdapterFactory,
  RewardFreezerFactory,
  TokenWeightedRewardPoolFactory,
  PermitFreezerRewardPoolFactory,
  TeamRewardPoolFactory,
  DecayingTokenLockerFactory,
  StakeConfiguratorFactory,
  MintableDelegationERC20,
  TokenWeightedRewardPoolV1Factory,
  MockRewardedTokenLockerFactory,
  StaticPriceOracleFactory,
  ReferralRewardPoolFactory,
  LendingPoolCompatibleFactory,
} from '../types';
import {
  withSaveAndVerify,
  registerContractInJsonDb,
  linkBytecode,
  withVerify,
  withSaveAndVerifyOnce,
} from './contracts-helpers';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { TreasuryRewardPoolFactory } from '../types/TreasuryRewardPoolFactory';
import { ReferralRewardPoolV1Factory } from '../types/ReferralRewardPoolV1Factory';
import { RewardBoosterV1Factory } from '../types/RewardBoosterV1Factory';

const readArtifact = async (id: string) => {
  return (DRE as HardhatRuntimeEnvironment).artifacts.readArtifact(id);
};

export const deployMarketAccessController = async (marketId: string, verify?: boolean) =>
  withSaveAndVerify(
    await new MarketAccessControllerFactory(await getFirstSigner()).deploy(marketId),
    eContractid.MarketAccessController,
    [marketId],
    verify
  );

export const deployMarketAccessControllerNoSave = async (marketId: string) =>
  await new MarketAccessControllerFactory(await getFirstSigner()).deploy(marketId);

export const deployAddressesProviderRegistry = async (verify?: boolean) =>
  withSaveAndVerify(
    await new AddressesProviderRegistryFactory(await getFirstSigner()).deploy(),
    eContractid.AddressesProviderRegistry,
    [],
    verify
  );

export const deployLendingPoolConfiguratorImpl = async (verify: boolean, once: boolean) =>
  withSaveAndVerifyOnce(
    new LendingPoolConfiguratorFactory(await getFirstSigner()),
    eContractid.LendingPoolConfiguratorImpl,
    [],
    verify,
    once
  );

export const deployReserveLogicLibrary = async (verify?: boolean) =>
  withSaveAndVerify(
    await new ReserveLogicFactory(await getFirstSigner()).deploy(),
    eContractid.ReserveLogic,
    [],
    verify
  );

export const deployGenericLogic = async (reserveLogic: Contract, verify?: boolean) => {
  const genericLogicArtifact = await readArtifact(eContractid.GenericLogic);

  const linkedGenericLogicByteCode = linkBytecode(genericLogicArtifact, {
    [eContractid.ReserveLogic]: reserveLogic.address,
  });

  const genericLogicFactory = await getContractFactory(
    genericLogicArtifact.abi,
    linkedGenericLogicByteCode
  );

  const genericLogic = await (await genericLogicFactory.deploy()).deployed();
  return withSaveAndVerify(genericLogic, eContractid.GenericLogic, [], verify);
};

export const deployValidationLogic = async (
  reserveLogic: Contract,
  genericLogic: Contract,
  verify?: boolean
) => {
  const validationLogicArtifact = await readArtifact(eContractid.ValidationLogic);

  const linkedValidationLogicByteCode = linkBytecode(validationLogicArtifact, {
    [eContractid.ReserveLogic]: reserveLogic.address,
    [eContractid.GenericLogic]: genericLogic.address,
  });

  const validationLogicFactory = await getContractFactory(
    validationLogicArtifact.abi,
    linkedValidationLogicByteCode
  );

  const validationLogic = await (await validationLogicFactory.deploy()).deployed();

  return withSaveAndVerify(validationLogic, eContractid.ValidationLogic, [], verify);
};

// const deployLendingPoolLibraries = async (
//   verify?: boolean
// ): Promise<LendingPoolLibraryAddresses> => {
//   const reserveLogic = await deployReserveLogicLibrary(verify);
//   const genericLogic = await deployGenericLogic(reserveLogic, verify);
//   const validationLogic = await deployValidationLogic(reserveLogic, genericLogic, verify);

//   // Hardcoded solidity placeholders, if any library changes path this will fail.
//   // tslint:disable-next-line:max-line-length
//   // The '__$PLACEHOLDER$__ can be calculated via solidity keccak, but the LendingPoolLibraryAddresses Type seems to
//   // require a hardcoded string.
//   //
//   //  how-to:
//   //  1. PLACEHOLDER = solidityKeccak256(['string'], `${libPath}:${libName}`).slice(2, 36)
//   //  2. LIB_PLACEHOLDER = `__$${PLACEHOLDER}$__`
//   // or grab placeholdes from LendingPoolLibraryAddresses at Typechain generation.
//   //
//   // libPath example: contracts/libraries/logic/GenericLogic.sol
//   // libName example: GenericLogic
//   return {
//     ['__$de8c0cf1a7d7c36c802af9a64fb9d86036$__']: validationLogic.address,
//     ['__$22cd43a9dda9ce44e9b92ba393b88fb9ac$__']: reserveLogic.address,
//   };
// };

export const deployLendingPoolImpl = async (verify: boolean, once: boolean) => {
  // const libraries = await deployLendingPoolLibraries(verify);
  return await withSaveAndVerifyOnce(
    new LendingPoolCompatibleFactory(/* libraries, */ await getFirstSigner()),
    eContractid.LendingPoolImpl,
    [],
    verify,
    once
  );
};

export const deployLendingPoolCollateralManagerImpl = async (verify: boolean, once: boolean) => {
  return await withSaveAndVerifyOnce(
    new LendingPoolCollateralManagerFactory(/* libraries, */ await getFirstSigner()),
    eContractid.LendingPoolCollateralManagerImpl,
    [],
    verify,
    once
  );
};

export const deployMockPriceOracle = async (verify?: boolean) =>
  withSaveAndVerify(
    await new MockPriceOracleFactory(await getFirstSigner()).deploy(),
    eContractid.MockPriceOracle,
    [],
    verify
  );

export const deployLendingRateOracle = async (args: [tEthereumAddress], verify?: boolean) =>
  withSaveAndVerify(
    await new LendingRateOracleFactory(await getFirstSigner()).deploy(...args),
    eContractid.LendingRateOracle,
    [],
    verify
  );

export const deployMockAggregator = async (price: tStringTokenSmallUnits, verify?: boolean) =>
  withSaveAndVerify(
    await new MockAggregatorFactory(await getFirstSigner()).deploy(price),
    eContractid.MockAggregator,
    [price],
    verify
  );

export const deployOracleRouter = async (
  args: [
    tEthereumAddress,
    tEthereumAddress[],
    tEthereumAddress[],
    tEthereumAddress,
    tEthereumAddress
  ],
  verify?: boolean
) =>
  withSaveAndVerify(
    await new OracleRouterFactory(await getFirstSigner()).deploy(...args),
    eContractid.OracleRouter,
    args,
    verify
  );

export const deployStaticPriceOracle = async (
  args: [remoteAcl: string, assets_: string[], prices_: BigNumberish[]],
  verify?: boolean
) =>
  withSaveAndVerify(
    await new StaticPriceOracleFactory(await getFirstSigner()).deploy(...args),
    eContractid.StaticPriceOracle,
    [],
    verify
  );

export const deployMockFlashLoanReceiver = async (
  addressesProvider: tEthereumAddress,
  verify?: boolean
) =>
  withSaveAndVerify(
    await new MockFlashLoanReceiverFactory(await getFirstSigner()).deploy(addressesProvider),
    eContractid.MockFlashLoanReceiver,
    [addressesProvider],
    verify
  );

export const deployProtocolDataProvider = async (
  addressesProvider: tEthereumAddress,
  verify?: boolean
) =>
  withSaveAndVerify(
    await new ProtocolDataProviderFactory(await getFirstSigner()).deploy(addressesProvider),
    eContractid.ProtocolDataProvider,
    [addressesProvider],
    verify
  );

export const deployMintableERC20 = async (
  args: [string, string, string],
  verify?: boolean
): Promise<MintableERC20> =>
  withVerify(
    await new MintableERC20Factory(await getFirstSigner()).deploy(...args),
    'MintableERC20',
    args,
    verify
  );

export const deployMintableDelegationERC20 = async (
  args: [string, string, string],
  verify?: boolean
): Promise<MintableDelegationERC20> =>
  withVerify(
    await new MintableDelegationERC20Factory(await getFirstSigner()).deploy(...args),
    'MintableDelegationERC20',
    args,
    verify
  );

export const deployDefaultReserveInterestRateStrategy = async (
  args: [tEthereumAddress, string, string, string, string, string, string],
  verify: boolean
) =>
  withVerify(
    await new DefaultReserveInterestRateStrategyFactory(await getFirstSigner()).deploy(...args),
    'DefaultReserveInterestRateStrategy',
    args,
    verify
  );

export const deployStableDebtToken = async (
  [poolAddress, underlyingAssetAddress, treasuryAddress, name, symbol]: [
    tEthereumAddress,
    tEthereumAddress,
    tEthereumAddress,
    string,
    string
  ],
  verify: boolean
) => {
  const instance = await withVerify(
    await new StableDebtTokenFactory(await getFirstSigner()).deploy(),
    'VariableDebtToken',
    [],
    verify
  );

  await instance.initialize(
    {
      pool: poolAddress,
      treasury: treasuryAddress,
      underlyingAsset: underlyingAssetAddress,
    },
    name,
    symbol,
    '18',
    '0x10'
  );

  return instance;
};

export const deployVariableDebtToken = async (
  [poolAddress, underlyingAssetAddress, treasuryAddress, name, symbol]: [
    tEthereumAddress,
    tEthereumAddress,
    tEthereumAddress,
    string,
    string
  ],
  verify: boolean
) => {
  const instance = await withVerify(
    await new VariableDebtTokenFactory(await getFirstSigner()).deploy(),
    'VariableDebtToken',
    [],
    verify
  );

  await instance.initialize(
    {
      pool: poolAddress,
      treasury: treasuryAddress,
      underlyingAsset: underlyingAssetAddress,
    },
    name,
    symbol,
    '18',
    '0x10'
  );

  return instance;
};

export const deployDepositToken = async (
  [poolAddress, underlyingAssetAddress, treasuryAddress, name, symbol]: [
    tEthereumAddress,
    tEthereumAddress,
    tEthereumAddress,
    string,
    string
  ],
  verify: boolean
) => {
  const instance = await withVerify(
    await new DepositTokenFactory(await getFirstSigner()).deploy(),
    'DepositToken',
    [],
    verify
  );

  await instance.initialize(
    {
      pool: poolAddress,
      treasury: treasuryAddress,
      underlyingAsset: underlyingAssetAddress,
    },
    name,
    symbol,
    '18',
    '0x10'
  );

  return instance;
};

export const deployDelegationAwareDepositToken = async (
  [pool, underlyingAssetAddress, treasuryAddress, name, symbol]: [
    tEthereumAddress,
    tEthereumAddress,
    tEthereumAddress,
    string,
    string
  ],
  verify: boolean
) => {
  const instance = await withVerify(
    await new DelegationAwareDepositTokenFactory(await getFirstSigner()).deploy(),
    'DelegationAwareDepositToken',
    [],
    verify
  );

  await instance.initialize(
    {
      pool,
      treasury: treasuryAddress,
      underlyingAsset: underlyingAssetAddress,
    },
    name,
    symbol,
    '18',
    '0x10'
  );

  return instance;
};

export const deployStableDebtTokenImpl = async (verify: boolean, once: boolean) =>
  withSaveAndVerifyOnce(
    new StableDebtTokenFactory(await getFirstSigner()),
    eContractid.StableDebtTokenImpl,
    [],
    verify,
    once
  );

export const deployVariableDebtTokenImpl = async (verify: boolean, once: boolean) =>
  withSaveAndVerifyOnce(
    new VariableDebtTokenFactory(await getFirstSigner()),
    eContractid.VariableDebtTokenImpl,
    [],
    verify,
    once
  );

export const deployDepositTokenImpl = async (verify: boolean, once: boolean) =>
  withSaveAndVerifyOnce(
    new DepositTokenFactory(await getFirstSigner()),
    eContractid.DepositTokenImpl,
    [],
    verify,
    once
  );

export const deployDelegationAwareDepositTokenImpl = async (verify: boolean, once: boolean) =>
  withSaveAndVerifyOnce(
    new DelegationAwareDepositTokenFactory(await getFirstSigner()),
    eContractid.DelegationAwareDepositTokenImpl,
    [],
    verify,
    once
  );

export const deployAllMockTokens = async (verify?: boolean) => {
  const tokens: { [symbol: string]: MockContract | MintableERC20 } = {};

  const protoConfigData = getReservesConfigByPool(LendingPools.augmented);

  for (const tokenSymbol of Object.keys(TokenContractId)) {
    let decimals = '18';

    let configData = (<any>protoConfigData)[tokenSymbol];

    tokens[tokenSymbol] = await deployMintableERC20(
      [tokenSymbol, tokenSymbol, configData ? configData.reserveDecimals : decimals],
      verify
    );
    await registerContractInJsonDb(tokenSymbol.toUpperCase(), tokens[tokenSymbol]);
  }
  return tokens;
};

export const deployMockTokens = async (config: PoolConfiguration, verify?: boolean) => {
  const tokens: { [symbol: string]: MockContract | MintableERC20 } = {};
  const defaultDecimals = 18;

  const configData = config.ReservesConfig;

  for (const tokenSymbol of Object.keys(configData)) {
    tokens[tokenSymbol] = await deployMintableERC20(
      [
        tokenSymbol,
        tokenSymbol,
        configData[tokenSymbol as keyof iMultiPoolsAssets<IReserveParams>].reserveDecimals ||
          defaultDecimals.toString(),
      ],
      verify
    );
    await registerContractInJsonDb(tokenSymbol.toUpperCase(), tokens[tokenSymbol]);
  }
  return tokens;
};

export const deployWETHGateway = async (
  args: [tEthereumAddress, tEthereumAddress],
  verify?: boolean
) =>
  withSaveAndVerify(
    await new WETHGatewayFactory(await getFirstSigner()).deploy(...args),
    eContractid.WETHGateway,
    args,
    verify
  );

export const deployMockStableDebtToken = async (
  args: [tEthereumAddress, tEthereumAddress, string, string, string],
  verify?: boolean
) => {
  const instance = await withVerify(
    await new MockStableDebtTokenFactory(await getFirstSigner()).deploy(),
    eContractid.MockStableDebtToken,
    [],
    verify
  );

  await instance.initialize(
    {
      pool: args[0],
      treasury: ZERO_ADDRESS,
      underlyingAsset: args[1],
    },
    args[2],
    args[3],
    '18',
    args[4]
  );

  return instance;
};

export const deployWETHMocked = async (verify?: boolean) =>
  withSaveAndVerify(
    await new WETH9MockedFactory(await getFirstSigner()).deploy(),
    eContractid.WETHMocked,
    [],
    verify
  );

export const deployMockVariableDebtToken = async (
  args: [tEthereumAddress, tEthereumAddress, string, string, string],
  verify?: boolean
) => {
  const instance = await withVerify(
    await new MockVariableDebtTokenFactory(await getFirstSigner()).deploy(),
    eContractid.MockVariableDebtToken,
    [],
    verify
  );

  await instance.initialize(
    {
      pool: args[0],
      treasury: ZERO_ADDRESS,
      underlyingAsset: args[1],
    },
    args[2],
    args[3],
    '18',
    args[4]
  );

  return instance;
};

export const deployMockDepositToken = async (
  args: [tEthereumAddress, tEthereumAddress, tEthereumAddress, string, string, string],
  verify?: boolean
) => {
  const instance = await withVerify(
    await new MockDepositTokenFactory(await getFirstSigner()).deploy(),
    eContractid.MockDepositToken,
    [],
    verify
  );

  await instance.initialize(
    { pool: args[0], treasury: args[2], underlyingAsset: args[1] },
    args[3],
    args[4],
    '18',
    args[5]
  );

  return instance;
};

export const deployMockAgfToken = async (
  args: [tEthereumAddress, string, string],
  verify?: boolean
) => {
  const instance = await withSaveAndVerify(
    await new MockAgfTokenFactory(await getFirstSigner()).deploy(),
    eContractid.MockAgfToken,
    [],
    verify
  );

  await instance['initialize((address,string,string,uint8))']({
    remoteAcl: args[0],
    name: args[1],
    symbol: args[2],
    decimals: 18,
  });

  return instance;
};

export const deployMockStakedAgToken = async (
  args: [tEthereumAddress, tEthereumAddress, string, string, number, number],
  verify?: boolean
) => {
  const instance = await withSaveAndVerify(
    await new MockStakedAgfTokenFactory(await getFirstSigner()).deploy(),
    eContractid.MockStakedAgToken,
    [],
    verify
  );
  await instance.initialize(
    {
      stakeController: args[0],
      stakedToken: args[1],
      cooldownPeriod: args[4],
      unstakePeriod: args[5],
      maxSlashable: 3000, // 30%
    },
    args[2],
    args[3],
    '18'
  );

  return instance;
};

export const deployMockStakedAgfToken = async (
  args: [tEthereumAddress, tEthereumAddress, string, string, number, number],
  verify?: boolean
) => {
  const instance = await withSaveAndVerify(
    await new MockStakedAgfTokenFactory(await getFirstSigner()).deploy(),
    eContractid.MockStakedAgfToken,
    [],
    verify
  );
  await instance.initialize(
    {
      stakeController: args[0],
      stakedToken: args[1],
      cooldownPeriod: args[4],
      unstakePeriod: args[5],
      maxSlashable: 3000, // 30%
    },
    args[2],
    args[3],
    '18'
  );

  return instance;
};

export const deploySelfdestructTransferMock = async (verify?: boolean) =>
  withVerify(
    await new SelfdestructTransferFactory(await getFirstSigner()).deploy(),
    'SelfdestructTransfer',
    [],
    verify
  );

export const deployMockUniswapRouter = async (verify?: boolean) =>
  withSaveAndVerify(
    await new MockUniswapV2Router02Factory(await getFirstSigner()).deploy(),
    eContractid.MockUniswapV2Router02,
    [],
    verify
  );

export const deployUniswapLiquiditySwapAdapter = async (
  args: [tEthereumAddress, tEthereumAddress, tEthereumAddress],
  verify?: boolean
) =>
  withSaveAndVerify(
    await new UniswapLiquiditySwapAdapterFactory(await getFirstSigner()).deploy(...args),
    eContractid.UniswapLiquiditySwapAdapter,
    args,
    verify
  );

export const deployUniswapRepayAdapter = async (
  args: [tEthereumAddress, tEthereumAddress, tEthereumAddress],
  verify?: boolean
) =>
  withSaveAndVerify(
    await new UniswapRepayAdapterFactory(await getFirstSigner()).deploy(...args),
    eContractid.UniswapRepayAdapter,
    args,
    verify
  );

export const deployFlashLiquidationAdapter = async (
  args: [tEthereumAddress, tEthereumAddress, tEthereumAddress],
  verify?: boolean
) =>
  withSaveAndVerify(
    await new FlashLiquidationAdapterFactory(await getFirstSigner()).deploy(...args),
    eContractid.FlashLiquidationAdapter,
    args,
    verify
  );

export const deployRewardBoosterV1Impl = async (verify: boolean, once: boolean) =>
  withSaveAndVerifyOnce(
    new RewardBoosterV1Factory(await getFirstSigner()),
    eContractid.RewardBoosterImpl,
    [],
    verify,
    once
  );

export const deployMockRewardBooster = async (
  args: [tEthereumAddress, tEthereumAddress],
  verify?: boolean
) =>
  withSaveAndVerify(
    await new RewardBoosterFactory(await getFirstSigner()).deploy(...args),
    eContractid.MockRewardBooster,
    [],
    verify
  );

export const deployMockTokenLocker = async (
  args: [
    controller: tEthereumAddress,
    initialRate: BigNumberish,
    baselinePercentage: BigNumberish,
    underlying: tEthereumAddress,
    pointPeriod: BigNumberish,
    maxValuePeriod: BigNumberish,
    maxWeightBase: BigNumberish
  ],
  verify?: boolean
) =>
  await withSaveAndVerify(
    await new MockRewardedTokenLockerFactory(await getFirstSigner()).deploy(...args),
    eContractid.MockTokenLocker,
    [],
    verify
  );

export const deployMockDecayingTokenLocker = async (
  args: [
    controller: tEthereumAddress,
    initialRate: BigNumberish,
    baselinePercentage: BigNumberish,
    underlying: tEthereumAddress,
    pointPeriod: BigNumberish,
    maxValuePeriod: BigNumberish,
    maxWeightBase: BigNumberish
  ],
  verify?: boolean
) =>
  await withSaveAndVerify(
    await new DecayingTokenLockerFactory(await getFirstSigner()).deploy(...args),
    eContractid.MockDecayingTokenLocker,
    [],
    verify
  );

export const deployMockRewardFreezer = async (
  args: [tEthereumAddress, tEthereumAddress],
  verify?: boolean
) =>
  withSaveAndVerify(
    await new RewardFreezerFactory(await getFirstSigner()).deploy(...args),
    eContractid.MockRewardFreezer,
    args,
    verify
  );

export const deployTeamRewardPool = async (
  args: [
    controller: tEthereumAddress,
    initialRate: BigNumberish,
    baselinePercentage: BigNumberish,
    teamManager: string
  ],
  verify?: boolean
) =>
  withSaveAndVerify(
    await new TeamRewardPoolFactory(await getFirstSigner()).deploy(...args),
    eContractid.TeamRewardPool,
    [],
    verify
  );

export const deployReferralRewardPoolV1Impl = async (verify: boolean, once: boolean) =>
  withSaveAndVerifyOnce(
    new ReferralRewardPoolV1Factory(await getFirstSigner()),
    eContractid.ReferralRewardPoolV1Impl,
    [],
    verify,
    once
  );

export const deployTreasuryRewardPool = async (
  args: [
    controller: string,
    initialRate: BigNumberish,
    baselinePercentage: BigNumberish,
    treasury: string
  ],
  verify?: boolean
) =>
  withSaveAndVerify(
    await new TreasuryRewardPoolFactory(await getFirstSigner()).deploy(...args),
    eContractid.TreasuryRewardPool,
    [],
    verify
  );

export const deployNamedPermitFreezerRewardPool = async (
  rewardPoolName: string,
  args: [controller: tEthereumAddress, rewardLimit: BigNumberish, meltDownAt: number],
  verify?: boolean
) =>
  withSaveAndVerify(
    await new PermitFreezerRewardPoolFactory(await getFirstSigner()).deploy(
      ...args,
      rewardPoolName
    ),
    rewardPoolName,
    [],
    verify
  );

export const deployTokenWeightedRewardPoolAGFBoosted = async (
  args: [tEthereumAddress, BigNumberish, BigNumberish, BigNumberish],
  verify?: boolean
) =>
  withSaveAndVerify(
    await new TokenWeightedRewardPoolFactory(await getFirstSigner()).deploy(...args),
    eContractid.TokenWeightedRewardPoolAGFBoosted,
    [],
    verify
  );

export const deployTokenWeightedRewardPoolAGFSeparate = async (
  args: [tEthereumAddress, BigNumberish, BigNumberish, BigNumberish],
  verify?: boolean
) =>
  withSaveAndVerify(
    await new TokenWeightedRewardPoolFactory(await getFirstSigner()).deploy(...args),
    eContractid.TokenWeightedRewardPoolAGFSeparate,
    [],
    verify
  );

export const deployTokenWeightedRewardPoolAG = async (
  args: [tEthereumAddress, BigNumberish, BigNumberish, BigNumberish],
  verify?: boolean
) =>
  withSaveAndVerify(
    await new TokenWeightedRewardPoolFactory(await getFirstSigner()).deploy(...args),
    eContractid.TokenWeightedRewardPoolAG,
    [],
    verify
  );

export const deployTokenWeightedRewardPoolAGBoosted = async (
  args: [tEthereumAddress, BigNumberish, BigNumberish, BigNumberish],
  verify?: boolean
) =>
  withSaveAndVerify(
    await new TokenWeightedRewardPoolFactory(await getFirstSigner()).deploy(...args),
    eContractid.TokenWeightedRewardPoolAGBoosted,
    [],
    verify
  );

export const deployTokenWeightedRewardPoolAGUSDCBoosted = async (
  args: [tEthereumAddress, BigNumberish, BigNumberish, BigNumberish],
  verify?: boolean
) =>
  withSaveAndVerify(
    await new TokenWeightedRewardPoolFactory(await getFirstSigner()).deploy(...args),
    eContractid.TokenWeightedRewardPoolAGUSDCBoosted,
    [],
    verify
  );

export const deployPermitFreezerRewardPool = async (
  args: [tEthereumAddress, BigNumberish, number, string],
  verify?: boolean
) =>
  withSaveAndVerify(
    await new PermitFreezerRewardPoolFactory(await getFirstSigner()).deploy(...args),
    eContractid.PermitFreezerRewardPool,
    [],
    verify
  );

export const deployReferralRewardPool = async (
  rewardPoolName: string,
  args: [controller: string, initialRate: BigNumberish, baselinePercentage: BigNumberish],
  verify?: boolean
) =>
  withSaveAndVerify(
    await new ReferralRewardPoolFactory(await getFirstSigner()).deploy(...args, rewardPoolName),
    eContractid.MockReferralRewardPool,
    [],
    verify
  );

export const deployStakeConfiguratorImpl = async (verify: boolean, once: boolean) =>
  withSaveAndVerifyOnce(
    new StakeConfiguratorFactory(await getFirstSigner()),
    eContractid.StakeConfiguratorImpl,
    [],
    verify,
    once
  );

export const deployStakeTokenImpl = async (verify: boolean, once: boolean) =>
  withSaveAndVerifyOnce(
    new StakeTokenFactory(await getFirstSigner()),
    eContractid.StakeTokenImpl,
    [],
    verify,
    once
  );

export const deployTreasuryImpl = async (verify: boolean, once: boolean) =>
  withSaveAndVerifyOnce(
    new TreasuryFactory(await getFirstSigner()),
    eContractid.TreasuryImpl,
    [],
    verify,
    once
  );

export const deployRewardConfiguratorImpl = async (verify: boolean, once: boolean) =>
  withSaveAndVerifyOnce(
    new RewardConfiguratorFactory(await getFirstSigner()),
    eContractid.RewardConfiguratorImpl,
    [],
    verify,
    once
  );

export const deployXAGFTokenV1Impl = async (verify: boolean, once: boolean) =>
  withSaveAndVerifyOnce(
    new XAGFTokenV1Factory(await getFirstSigner()),
    eContractid.XAGFTokenV1Impl,
    [],
    verify,
    once
  );

export const deployAGFTokenV1Impl = async (verify: boolean, once: boolean) =>
  withSaveAndVerifyOnce(
    new AGFTokenV1Factory(await getFirstSigner()),
    eContractid.AGFTokenV1Impl,
    [],
    verify,
    once
  );

export const deployTokenWeightedRewardPoolImpl = async (verify: boolean, once: boolean) =>
  withSaveAndVerifyOnce(
    new TokenWeightedRewardPoolV1Factory(await getFirstSigner()),
    eContractid.TokenWeightedRewardPoolImpl,
    [],
    verify,
    once
  );
