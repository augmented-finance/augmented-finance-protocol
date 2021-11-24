import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumberish } from 'ethers';
import { ethers, run } from 'hardhat';
import { expect } from 'chai';

import { CFG } from '../../tasks/migrations/defaultTestDeployConfig';
import {
  getAGTokenByName,
  getLendingPoolProxy,
  getMarketAddressController,
  getMintableERC20,
  getMockPriceOracle,
  getProtocolDataProvider,
} from '../../helpers/contracts-getters';
import { HALF_WAD, RAY, WAD } from '../../helpers/constants';
import { DepositToken, LendingPool, MintableERC20, MockPriceOracle, ProtocolDataProvider } from '../../types';
import { takeSnapshot, revertSnapshot, mineTicks } from '../test-augmented/utils';

describe('Calculate APY rewards', () => {
  let rootSigner: SignerWithAddress, userSigner: SignerWithAddress;
  let depositDAI: DepositToken, depositUSDC: DepositToken;
  let underlyingTokenDAI: MintableERC20, underlyingTokenUSDC: MintableERC20;
  let oracle: MockPriceOracle;
  let lendingPool: LendingPool, dataProvider: ProtocolDataProvider;
  let snapshot: string;

  const REF_CODE = 0;
  const VARIABLE_MODE = 2;
  const CONFIRMATIONS = 10;

  const deposit = async (token: MintableERC20, signer: SignerWithAddress, amount: BigNumberish): Promise<void> => {
    await token.mint(amount);
    await token.approve(lendingPool.address, amount);
    await lendingPool.deposit(token.address, amount, signer.address, REF_CODE);
  };

  const borrow = async (token: MintableERC20, signer: SignerWithAddress, amount: BigNumberish): Promise<void> => {
    await lendingPool.connect(signer).borrow(token.address, amount, VARIABLE_MODE, REF_CODE, signer.address);
  };

  before(async () => {
    [rootSigner, userSigner] = await ethers.getSigners();

    await run('augmented:test-local', CFG);

    [depositDAI, depositUSDC] = await Promise.all([getAGTokenByName('agDAI'), getAGTokenByName('agUSDC')]);
    const [underlyingDAI, underlyingUSDC] = await Promise.all([
      depositDAI.UNDERLYING_ASSET_ADDRESS(),
      depositUSDC.UNDERLYING_ASSET_ADDRESS(),
    ]);

    const [poolAddress, marketAccessConroller] = await Promise.all([depositDAI.POOL(), getMarketAddressController()]);

    [underlyingTokenDAI, underlyingTokenUSDC, lendingPool, oracle, dataProvider] = await Promise.all([
      getMintableERC20(underlyingDAI),
      getMintableERC20(underlyingUSDC),
      getLendingPoolProxy(poolAddress),
      getMockPriceOracle(await marketAccessConroller.getPriceOracle()),
      getProtocolDataProvider(),
    ]);

    await Promise.all([deposit(underlyingTokenDAI, rootSigner, WAD), deposit(underlyingTokenUSDC, userSigner, WAD)]);
    await borrow(underlyingTokenDAI, userSigner, HALF_WAD);

    await mineTicks(CONFIRMATIONS);

    expect(await lendingPool.getReserveNormalizedIncome(underlyingDAI)).to.be.gt(RAY);

    await Promise.all([
      oracle.setAssetPrice(underlyingUSDC, '233196472894407'),
      oracle.setAssetPrice(underlyingDAI, '234661674440170'),
      oracle.setAssetPrice(depositDAI.address, '233196472894407'),
      oracle.setAssetPrice(depositUSDC.address, '234661674440170'),
    ]);
  });

  beforeEach(async () => {
    snapshot = await takeSnapshot();
  });

  afterEach(async () => {
    await revertSnapshot(snapshot);
  });

  it('should calculate APY for agDAI properly after the new deposit', async () => {
    const daiReserve = await dataProvider.getReserveData(underlyingTokenDAI.address);
    const initialLiquidityRate = daiReserve.liquidityRate;

    await deposit(underlyingTokenDAI, userSigner, WAD);

    const { liquidityRate } = await dataProvider.getReserveData(underlyingTokenDAI.address);
    expect(initialLiquidityRate).to.be.gt(liquidityRate);
  });
});
