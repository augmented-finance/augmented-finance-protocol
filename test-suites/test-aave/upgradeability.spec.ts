import { expect } from 'chai';
import { makeSuite, TestEnv } from './helpers/make-suite';
import { ProtocolErrors, eContractid } from '../../helpers/types';
import { deployContract, getContract } from '../../helpers/contracts-helpers';
import { ZERO_ADDRESS } from '../../helpers/constants';
import {
  getAgfToken,
  getAToken,
  getMockStableDebtToken,
  getMockVariableDebtToken,
  getStableDebtToken,
  getVariableDebtToken,
} from '../../helpers/contracts-getters';
import {
  deployMockDepositToken,
  deployMockStableDebtToken,
  deployMockVariableDebtToken,
  deployMockAgfToken,
  deployMockStakedAgfToken,
} from '../../helpers/contracts-deployments';

makeSuite('Upgradeability', (testEnv: TestEnv) => {
  const { CALLER_NOT_POOL_ADMIN } = ProtocolErrors;
  let newAgfTokenAddress: string;
  let newATokenAddress: string;
  let newStableTokenAddress: string;
  let newVariableTokenAddress: string;

  before('deploying instances', async () => {
    const { dai, pool } = testEnv;
    const aTokenInstance = await deployMockDepositToken([
      pool.address,
      dai.address,
      ZERO_ADDRESS,
      ZERO_ADDRESS,
      'Interest bearing DAI updated',
      'aDAI',
      '0x10',
    ]);

    const stableDebtTokenInstance = await deployMockStableDebtToken([
      pool.address,
      dai.address,
      ZERO_ADDRESS,
      'Stable debt bearing DAI updated',
      'stableDebtDAI',
      '0x10',
    ]);

    const variableDebtTokenInstance = await deployMockVariableDebtToken([
      pool.address,
      dai.address,
      ZERO_ADDRESS,
      'Variable debt bearing DAI updated',
      'variableDebtDAI',
      '0x10',
    ]);

    const agfTokenInstance = await deployMockAgfToken([
      ZERO_ADDRESS,
      'Reward token updated',
      'AGF',
    ]);

    newATokenAddress = aTokenInstance.address;
    newVariableTokenAddress = variableDebtTokenInstance.address;
    newStableTokenAddress = stableDebtTokenInstance.address;
    newAgfTokenAddress = agfTokenInstance.address;
  });

  it('Tries to update the DAI Atoken implementation with a different address than the lendingPoolManager', async () => {
    const { dai, configurator, users } = testEnv;

    const newImpl = await getAToken(newATokenAddress);
    const name = await newImpl.name();
    const symbol = await newImpl.symbol();

    const updateATokenInputParams: {
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
      implementation: newATokenAddress,
      params: '0x10',
    };
    await expect(
      configurator.connect(users[1].signer).updateAToken(updateATokenInputParams)
    ).to.be.revertedWith(CALLER_NOT_POOL_ADMIN);
  });

  it('Upgrades the DAI Atoken implementation ', async () => {
    const { dai, configurator, aDai } = testEnv;

    const newImpl = await getAToken(newATokenAddress);
    const name = await newImpl.name();
    const symbol = await newImpl.symbol();
    const revision = await newImpl.REVISION();

    const domainSep = await aDai.DOMAIN_SEPARATOR();

    expect(name).not.eq(await aDai.name());
    expect(newImpl.DOMAIN_SEPARATOR()).not.eq(domainSep);
    expect(revision).not.eq(await aDai.REVISION());

    const updateATokenInputParams: {
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
      implementation: newATokenAddress,
      params: '0x10',
    };
    await configurator.updateAToken(updateATokenInputParams);

    expect(await aDai.name()).to.be.eq(name, 'Invalid token name');
    expect(await aDai.REVISION()).eq(revision);
    expect(await aDai.DOMAIN_SEPARATOR()).eq(domainSep);
  });

  // it('Upgrades the AGF Atoken implementation ', async () => {
  //   const { agf } = testEnv;

  //   const newImpl = await getAgfToken(newAgfTokenAddress);
  //   const name = await newImpl.name();
  //   const symbol = await newImpl.symbol();
  //   const revision = await newImpl.REVISION();

  //   const domainSep = await agf.DOMAIN_SEPARATOR();

  //   expect(name).not.eq(await agf.name());
  //   expect(newImpl.DOMAIN_SEPARATOR()).not.eq(domainSep);
  //   expect(revision).not.eq(await agf.REVISION());

  //   // todo upgrade token

  //   expect(await agf.name()).to.be.eq(name, 'Invalid token name');
  //   expect(await agf.REVISION()).eq(revision);
  //   expect(await agf.DOMAIN_SEPARATOR()).eq(domainSep);
  // });

  it('Tries to update the DAI Stable debt token implementation with a different address than the lendingPoolManager', async () => {
    const { dai, configurator, users } = testEnv;

    const newImpl = await getStableDebtToken(newStableTokenAddress);
    const name = await newImpl.name();
    const symbol = await newImpl.symbol();

    const updateDebtTokenInput: {
      asset: string;
      incentivesController: string;
      name: string;
      symbol: string;
      implementation: string;
      params: string;
    } = {
      asset: dai.address,
      incentivesController: ZERO_ADDRESS,
      name: name,
      symbol: symbol,
      implementation: newStableTokenAddress,
      params: '0x10',
    };

    await expect(
      configurator.connect(users[1].signer).updateStableDebtToken(updateDebtTokenInput)
    ).to.be.revertedWith(CALLER_NOT_POOL_ADMIN);
  });

  it('Upgrades the DAI stable debt token implementation ', async () => {
    const { dai, configurator, pool, helpersContract } = testEnv;

    const newImpl = await getStableDebtToken(newStableTokenAddress);
    const name = await newImpl.name();
    const symbol = await newImpl.symbol();

    const updateDebtTokenInput: {
      asset: string;
      incentivesController: string;
      name: string;
      symbol: string;
      implementation: string;
      params: string;
    } = {
      asset: dai.address,
      incentivesController: ZERO_ADDRESS,
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

  it('Tries to update the DAI variable debt token implementation with a different address than the lendingPoolManager', async () => {
    const { dai, configurator, users } = testEnv;

    const newImpl = await getVariableDebtToken(newVariableTokenAddress);
    const name = await newImpl.name();
    const symbol = await newImpl.symbol();

    const updateDebtTokenInput: {
      asset: string;
      incentivesController: string;
      name: string;
      symbol: string;
      implementation: string;
      params: string;
    } = {
      asset: dai.address,
      incentivesController: ZERO_ADDRESS,
      name: name,
      symbol: symbol,
      implementation: newVariableTokenAddress,
      params: '0x10',
    };

    await expect(
      configurator.connect(users[1].signer).updateVariableDebtToken(updateDebtTokenInput)
    ).to.be.revertedWith(CALLER_NOT_POOL_ADMIN);
  });

  it('Upgrades the DAI variable debt token implementation ', async () => {
    const { dai, configurator, pool, helpersContract } = testEnv;

    const newImpl = await getVariableDebtToken(newVariableTokenAddress);
    const name = await newImpl.name();
    const symbol = await newImpl.symbol();

    const updateDebtTokenInput: {
      asset: string;
      incentivesController: string;
      name: string;
      symbol: string;
      implementation: string;
      params: string;
    } = {
      asset: dai.address,
      incentivesController: ZERO_ADDRESS,
      name: name,
      symbol: symbol,
      implementation: newVariableTokenAddress,
      params: '0x10',
    };
    //const name = await (await getAToken(newATokenAddress)).name();

    await configurator.updateVariableDebtToken(updateDebtTokenInput);

    const { variableDebtTokenAddress } = await helpersContract.getReserveTokensAddresses(
      dai.address
    );

    const debtToken = await getMockVariableDebtToken(variableDebtTokenAddress);
    expect(await debtToken.name()).to.be.eq(name, 'Invalid token name');
  });
});
