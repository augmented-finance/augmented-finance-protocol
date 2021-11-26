import { run } from 'hardhat';
import { BigNumber } from 'ethers';
import { expect } from 'chai';

import { CFG } from '../../../tasks/migrations/defaultTestDeployConfig';
import {
  getAGTokenByName,
  getMockAgfToken,
  getMockUniEthPair,
  getWETHGateway,
} from '../../../helpers/contracts-getters';
import { deployMockUniEthPair, deployPriceFeedUniEthToken } from '../../../helpers/contracts-deployments';
import { WAD } from '../../../helpers/constants';
import { revertSnapshot, takeSnapshot } from '../../test-augmented/utils';
import { MockAgfToken, WETHGateway } from '../../../types';

describe('contracts/misc/PriceFeedUniEthToken.sol', () => {
  let agf: MockAgfToken;
  let weth: WETHGateway;
  let wethAddress: string;
  let snapshotId: string;

  before(async () => {
    await run('augmented:test-local', CFG);

    [agf, weth] = await Promise.all([getMockAgfToken(), getWETHGateway()]);
    wethAddress = await weth.getWETHAddress();
  });

  beforeEach(async () => {
    snapshotId = await takeSnapshot();
  });

  afterEach(async () => {
    await revertSnapshot(snapshotId);
  });

  it('should create price feed for UniETH token', async () => {
    await deployMockUniEthPair([agf.address, wethAddress, 0, 0]);
    const pair = await getMockUniEthPair();

    const uniAGFPriceFeed = await deployPriceFeedUniEthToken('AGF-ETH', [pair.address, wethAddress, WAD], false);
    expect(uniAGFPriceFeed).to.be.not.undefined;
  });

  it('should return price for AGF expressed in ETH', async () => {
    await deployMockUniEthPair([agf.address, wethAddress, 1e6, 1e4]);
    const pair = await getMockUniEthPair();

    const uniAGFPriceFeed = await deployPriceFeedUniEthToken('AGF-ETH', [pair.address, wethAddress, WAD], false);

    const result = await uniAGFPriceFeed.latestAnswer();
    expect(result).to.equal(BigNumber.from(10).pow(16));
  });

  it('should return price for AGF expressed in ETH with reverse order', async () => {
    await deployMockUniEthPair([wethAddress, agf.address, 1e4, 1e6]);
    const pair = await getMockUniEthPair();

    const uniAGFPriceFeed = await deployPriceFeedUniEthToken('AGF-ETH', [pair.address, wethAddress, WAD], false);

    const result = await uniAGFPriceFeed.latestAnswer();
    expect(result).to.equal(BigNumber.from(10).pow(16));
  });

  it('should return price for AGF expressed in DAI', async () => {
    const agDAI = await getAGTokenByName('agDAI');
    const daiAddress = await agDAI.UNDERLYING_ASSET_ADDRESS();
    await deployMockUniEthPair([agf.address, daiAddress, 1e3, 1e9]);
    const pair = await getMockUniEthPair();

    const uniAGFPriceFeed = await deployPriceFeedUniEthToken(
      'AGF-DAI',
      [pair.address, daiAddress, BigNumber.from(10).pow(8)],
      false
    );

    const result = await uniAGFPriceFeed.latestAnswer();
    expect(result).to.equal(BigNumber.from(10).pow(14));
  });

  it('should return price for AGF expressed in DAI with reverse order', async () => {
    const agDAI = await getAGTokenByName('agDAI');
    const daiAddress = await agDAI.UNDERLYING_ASSET_ADDRESS();
    await deployMockUniEthPair([daiAddress, agf.address, 1e9, 1e3]);
    const pair = await getMockUniEthPair();

    const uniAGFPriceFeed = await deployPriceFeedUniEthToken(
      'AGF-DAI',
      [pair.address, daiAddress, BigNumber.from(10).pow(8)],
      false
    );

    const result = await uniAGFPriceFeed.latestAnswer();
    expect(result).to.equal(BigNumber.from(10).pow(14));
  });
});
