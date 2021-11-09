import { expect } from 'chai';
import { makeSuite, TestEnv } from './helpers/make-suite';
import { ProtocolErrors } from '../../helpers/types';
import { ONE_ADDRESS, ZERO_ADDRESS } from '../../helpers/constants';
import {
  getAGFTokenImpl,
  getDepositToken,
  getMockLendingPoolImpl,
  getMockStableDebtToken,
  getMockVariableDebtToken,
  getStableDebtToken,
  getStakeConfiguratorImpl,
  getStakeTokenImpl,
  getVariableDebtToken,
} from '../../helpers/contracts-getters';
import {
  deployMockDepositToken,
  deployMockStableDebtToken,
  deployMockVariableDebtToken,
  deployMockAgfToken,
  deployLendingPoolImpl,
  deployAGFTokenImpl,
  deployStakeTokenImpl,
  deployStakeConfiguratorImpl,
  deployMockStakeToken,
} from '../../helpers/contracts-deployments';
import { AccessFlags } from '../../helpers/access-flags';
import { falsyOrZeroAddress } from '../../helpers/misc-utils';

makeSuite('Upgradeability', (testEnv: TestEnv) => {
  const { CALLER_NOT_POOL_ADMIN } = ProtocolErrors;
  let newDepositTokenAddress: string;
  let newStableTokenAddress: string;
  let newVariableTokenAddress: string;

  before('deploying instances', async () => {
    const { dai, pool } = testEnv;
    const depositTokenInstance = await deployMockDepositToken([
      pool.address,
      dai.address,
      ONE_ADDRESS,
      'Deposit DAI updated',
      'aDAI',
      '0x10',
    ]);

    const stableDebtTokenInstance = await deployMockStableDebtToken([
      pool.address,
      dai.address,
      'Stable debt DAI updated',
      'stableDebtDAI',
      '0x10',
    ]);

    const variableDebtTokenInstance = await deployMockVariableDebtToken([
      pool.address,
      dai.address,
      'Variable debt DAI updated',
      'variableDebtDAI',
      '0x10',
    ]);

    newDepositTokenAddress = depositTokenInstance.address;
    newVariableTokenAddress = variableDebtTokenInstance.address;
    newStableTokenAddress = stableDebtTokenInstance.address;
  });

  it('Tries to initialize lendingPool implemention', async () => {
    const { addressesProvider } = testEnv;
    const pool = await deployLendingPoolImpl(false, false);
    await expect(pool.initialize(addressesProvider.address)).to.be.revertedWith('initializer blocked');
  });

  it('Tries to re-initialize lendingPool from outside', async () => {
    const { pool, addressesProvider } = testEnv;
    await expect(pool.initialize(addressesProvider.address)).to.be.revertedWith('already initialized');
  });

  it('Tries to re-initialize lendingPool from inside', async () => {
    const { addressesProvider } = testEnv;
    const pool = await getMockLendingPoolImpl(testEnv.pool.address);
    await expect(pool.reInitialize(addressesProvider.address)).to.be.revertedWith('already initialized');
  });

  it('Tries to update agDAI implementation by an aunthorized caller', async () => {
    const { dai, configurator, users } = testEnv;

    const newImpl = await getDepositToken(newDepositTokenAddress);
    const name = await newImpl.name();
    const symbol = await newImpl.symbol();

    const updateDepositTokenInputParams: {
      asset: string;
      treasury: string;
      incentivesController: string;
      name: string;
      symbol: string;
      implementation: string;
      params: string;
    } = {
      asset: dai.address,
      treasury: ZERO_ADDRESS,
      incentivesController: ZERO_ADDRESS,
      name: name,
      symbol: symbol,
      implementation: newDepositTokenAddress,
      params: '0x10',
    };
    await expect(
      configurator.connect(users[1].signer).updateDepositToken(updateDepositTokenInputParams)
    ).to.be.revertedWith(CALLER_NOT_POOL_ADMIN);
  });

  it('Update agDAI implementation ', async () => {
    const { dai, configurator, aDai } = testEnv;

    const newImpl = await getDepositToken(newDepositTokenAddress);
    const name = await newImpl.name();
    const symbol = await newImpl.symbol();
    const revision = await newImpl.REVISION();

    const domainSep = await aDai.DOMAIN_SEPARATOR();

    expect(name).not.eq(await aDai.name());
    expect(newImpl.DOMAIN_SEPARATOR()).not.eq(domainSep);
    expect(revision).not.eq(await aDai.REVISION());

    const updateDepositTokenInputParams = {
      asset: dai.address,
      treasury: ZERO_ADDRESS,
      incentivesController: ZERO_ADDRESS,
      name: name,
      symbol: symbol,
      implementation: newDepositTokenAddress,
      params: '0x10',
    };
    await configurator.updateDepositToken(updateDepositTokenInputParams);

    expect(await aDai.name()).to.be.eq(name, 'Invalid token name');
    expect(await aDai.REVISION()).eq(revision);
    expect(await aDai.DOMAIN_SEPARATOR()).eq(domainSep);
  });

  it('Tries to update agsDAI (stable debt) implementation by an aunthorized caller', async () => {
    const { dai, configurator, users } = testEnv;

    const newImpl = await getStableDebtToken(newStableTokenAddress);
    const name = await newImpl.name();
    const symbol = await newImpl.symbol();

    const updateDebtTokenInput = {
      asset: dai.address,
      incentivesController: ZERO_ADDRESS,
      treasury: ZERO_ADDRESS,
      name: name,
      symbol: symbol,
      implementation: newStableTokenAddress,
      params: '0x10',
    };

    await expect(configurator.connect(users[1].signer).updateStableDebtToken(updateDebtTokenInput)).to.be.revertedWith(
      CALLER_NOT_POOL_ADMIN
    );
  });

  it('Update agsDAI (stable debt) implementation ', async () => {
    const { dai, configurator, pool, helpersContract } = testEnv;

    const newImpl = await getStableDebtToken(newStableTokenAddress);
    const name = await newImpl.name();
    const symbol = await newImpl.symbol();

    const updateDebtTokenInput = {
      asset: dai.address,
      incentivesController: ZERO_ADDRESS,
      treasury: ZERO_ADDRESS,
      name: name,
      symbol: symbol,
      implementation: newStableTokenAddress,
      params: '0x10',
    };

    await configurator.updateStableDebtToken(updateDebtTokenInput);

    const { stableDebtTokenAddress } = await helpersContract.getReserveTokensAddresses(dai.address);

    const debtToken = await getMockStableDebtToken(stableDebtTokenAddress);
    expect(await debtToken.name()).to.be.eq(name, 'Invalid token name');
  });

  it('Tries to update agvDAI (variable debt) implementation by an aunthorized caller', async () => {
    const { dai, configurator, users } = testEnv;

    const newImpl = await getVariableDebtToken(newVariableTokenAddress);
    const name = await newImpl.name();
    const symbol = await newImpl.symbol();

    const updateDebtTokenInput = {
      asset: dai.address,
      incentivesController: ZERO_ADDRESS,
      treasury: ZERO_ADDRESS,
      name: name,
      symbol: symbol,
      implementation: newVariableTokenAddress,
      params: '0x10',
    };

    await expect(
      configurator.connect(users[1].signer).updateVariableDebtToken(updateDebtTokenInput)
    ).to.be.revertedWith(CALLER_NOT_POOL_ADMIN);
  });

  it('Update agvDAI (variable debt) implementation ', async () => {
    const { dai, configurator, pool, helpersContract } = testEnv;

    const newImpl = await getVariableDebtToken(newVariableTokenAddress);
    const name = await newImpl.name();
    const symbol = await newImpl.symbol();

    const updateDebtTokenInput = {
      asset: dai.address,
      incentivesController: ZERO_ADDRESS,
      treasury: ZERO_ADDRESS,
      name: name,
      symbol: symbol,
      implementation: newVariableTokenAddress,
      params: '0x10',
    };
    //const name = await (await getDepositToken(newDepositTokenAddress)).name();

    await configurator.updateVariableDebtToken(updateDebtTokenInput);

    const { variableDebtTokenAddress } = await helpersContract.getReserveTokensAddresses(dai.address);

    const debtToken = await getMockVariableDebtToken(variableDebtTokenAddress);
    expect(await debtToken.name()).to.be.eq(name, 'Invalid token name');
  });

  it('Update AGF token implementation', async () => {
    const { addressesProvider } = testEnv;
    let agfAddr = await addressesProvider.getAddress(AccessFlags.REWARD_TOKEN);
    if (falsyOrZeroAddress(agfAddr)) {
      const agfImpl = await deployAGFTokenImpl(false, false);
      await addressesProvider.setAddressAsProxy(AccessFlags.REWARD_TOKEN, agfImpl.address);
      agfAddr = await addressesProvider.getAddress(AccessFlags.REWARD_TOKEN);
    }

    const agf = await getAGFTokenImpl(agfAddr);
    // const newImpl = await getAgfToken(newAgfTokenAddress);
    const name = await agf.name();
    const symbol = await agf.symbol();
    const revision = await agf.REVISION();
    const domainSep = await agf.DOMAIN_SEPARATOR();

    const newAgfImpl = await deployMockAgfToken([addressesProvider.address, 'Reward token updated', 'AGFv3']);
    const newRevision = await newAgfImpl.REVISION();
    expect(revision).not.eq(newRevision);

    await addressesProvider.setAddressAsProxy(AccessFlags.REWARD_TOKEN, newAgfImpl.address);

    expect(name).eq(await agf.name());
    expect(symbol).eq(await agf.symbol());
    expect(18).eq(await agf.decimals());
    expect(domainSep).eq(await agf.DOMAIN_SEPARATOR());
    {
      const rev = await agf.REVISION();
      expect(revision).lt(rev);
      expect(newRevision).eq(rev);
    }
  });

  it('Update stake token implementation', async () => {
    const { dai, addressesProvider, deployer } = testEnv;

    await addressesProvider.grantRoles(deployer.address, AccessFlags.STAKE_ADMIN);

    let scAddr = await addressesProvider.getAddress(AccessFlags.STAKE_CONFIGURATOR);
    if (falsyOrZeroAddress(scAddr)) {
      const impl = await deployStakeConfiguratorImpl(false, false);
      await addressesProvider.setAddressAsProxy(AccessFlags.STAKE_CONFIGURATOR, impl.address);
      scAddr = await addressesProvider.getAddress(AccessFlags.STAKE_CONFIGURATOR);
    }
    const sc = await getStakeConfiguratorImpl(scAddr);
    const stakeImpl = await deployStakeTokenImpl(false, false);

    const initParams = {
      stakeTokenImpl: stakeImpl.address,
      stakedToken: dai.address,
      strategy: ZERO_ADDRESS,
      stkTokenName: 'Test stake token',
      stkTokenSymbol: 'xagTEST',
      cooldownPeriod: 1,
      unstakePeriod: 7200,
      stkTokenDecimals: 18,
      maxSlashable: 3000,
      depositStake: false,
    };

    await sc.batchInitStakeTokens([initParams]);
    const stake = await getStakeTokenImpl(await sc.stakeTokenOf(dai.address));

    expect(await sc.implementationOf(stake.address)).eq(stakeImpl.address);

    expect(await stake.name()).eq(initParams.stkTokenName);
    expect(await stake.symbol()).eq(initParams.stkTokenSymbol);
    const revision = await stake.REVISION();
    const domainSep = await stake.DOMAIN_SEPARATOR();

    const impl2 = await deployMockStakeToken();
    const newRevision = await impl2.REVISION();
    expect(revision).not.eq(newRevision);

    const updParam = {
      token: stake.address,
      stakeTokenImpl: impl2.address,
      stkTokenName: 'Test 2 name',
      stkTokenSymbol: 'xag2TEST',
    };
    await sc.updateStakeToken(updParam);

    expect(18).eq(await stake.decimals());
    expect(domainSep).eq(await stake.DOMAIN_SEPARATOR());
    {
      const rev = await stake.REVISION();
      expect(revision).lt(rev);
      expect(newRevision).eq(rev);
    }

    expect(await sc.implementationOf(stake.address)).eq(impl2.address);

    expect(updParam.stkTokenName).eq(await stake.name());
    expect(updParam.stkTokenSymbol).eq(await stake.symbol());
  });
});
