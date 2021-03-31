import { ethers, network } from 'hardhat';
import chai from 'chai';
import { solidity } from 'ethereum-waffle';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { JsonRpcSigner } from '@ethersproject/providers/src.ts/json-rpc-provider';
import { BigNumberish } from '@ethersproject/bignumber';
import { Subscription, SubscriptionFactory } from '../../types';
import { IERC20 } from '../../types/IERC20';

chai.use(solidity);
const { expect } = chai;

const RICH_DONOR = '0x13aec50f5D3c011cd3fed44e2a30C515Bd8a5a06';
const DAI_CONTRACT = '0x6B175474E89094C44Da98b954EedeAC495271d0F';
const DAI_DECIMALS = 8;

const formatBalance = (balance: BigNumberish) => {
  return ethers.utils.formatUnits(balance, DAI_DECIMALS);
};

describe('Subscription Contract', () => {
  let subscription: Subscription;

  let otherUsers: SignerWithAddress[];
  let admin: SignerWithAddress;
  let user: SignerWithAddress;
  let richDonor: JsonRpcSigner;

  before(async () => {
    [admin, user, ...otherUsers] = await ethers.getSigners();
    console.log(`Admin address: ${admin.address}`);
    console.log(`User address: ${user.address}`);

    console.log('==== Deploy Contract');
    const subscriptionFactory = (await ethers.getContractFactory(
      'Subscription'
    )) as SubscriptionFactory;
    subscription = await subscriptionFactory.deploy(DAI_CONTRACT);
    await subscription.deployed();

    expect(subscription.address).to.properAddress;
  });

  beforeEach(async () => {
    // impersonate an owner of the wallet so we can call functions on it
    await network.provider.request({ method: 'hardhat_impersonateAccount', params: [RICH_DONOR] });
    richDonor = ethers.provider.getSigner(RICH_DONOR);
  });

  it('Should subscribe and unsubscribe', async () => {
    const dai = (await ethers.getContractAt('contracts/dependencies/openzeppelin/contracts/IERC20.sol:IERC20', DAI_CONTRACT)) as IERC20;
    const balanceBefore = await dai.connect(richDonor).balanceOf(RICH_DONOR);
    console.log(`Balance before: ${formatBalance(balanceBefore)}`);

    const mintValue = ethers.utils.parseUnits('3', DAI_DECIMALS);

    await dai.connect(richDonor).approve(subscription.address, mintValue);
    var tx = await subscription.connect(richDonor).subscribeForDeposit(mintValue);

    var res = await subscription.connect(richDonor).subscriptionTotal(RICH_DONOR);
    expect(res).to.eq(mintValue);

    await dai.connect(richDonor).approve(subscription.address, mintValue.mul(2));
    await subscription.connect(richDonor).subscribeForDeposit(mintValue.mul(2));
    res = await subscription.connect(richDonor).subscriptionTotal(RICH_DONOR);
    expect(res).to.eq(mintValue.mul(3));

    await subscription.connect(richDonor).unsubscribeDeposit(mintValue);
    res = await subscription.connect(richDonor).subscriptionTotal(RICH_DONOR);
    expect(res).to.eq(mintValue.mul(2));
    var allowance = await dai.connect(richDonor).allowance(subscription.address, RICH_DONOR);
    expect(allowance).to.eq(mintValue);

    await subscription.connect(richDonor).unsubscribeDeposit(mintValue.mul(5));
    res = await subscription.connect(richDonor).subscriptionTotal(RICH_DONOR);
    expect(res).to.eq(0);
    var allowance = await dai.connect(richDonor).allowance(subscription.address, RICH_DONOR);
    expect(allowance).to.eq(mintValue.mul(2));
  });

  it('Should estimate gas for subscribe/unsubscribe', async () => {
    const dai = (await ethers.getContractAt('contracts/dependencies/openzeppelin/contracts/IERC20.sol:IERC20', DAI_CONTRACT)) as IERC20;
    const balanceBefore = await dai.connect(richDonor).balanceOf(RICH_DONOR);

    const mintValue = ethers.utils.parseUnits('3', DAI_DECIMALS);

    await dai.connect(richDonor).approve(subscription.address, mintValue);
    var tx = await subscription.connect(richDonor).subscribeForDeposit(mintValue);
    var receipt = await tx.wait(0);
    console.log(`gasUsed by subscribe: ${receipt.gasUsed}`);

    tx = await subscription.connect(richDonor).unsubscribeDeposit(mintValue);
    var receipt = await tx.wait(0);
    console.log(`gasUsed by unsubscribe: ${receipt.gasUsed}`);
  });

  // it('Should estimate gas for execute', async () => {
  //   const dai = (await ethers.getContractAt('contracts/dependencies/openzeppelin/contracts/IERC20.sol:IERC20', DAI_CONTRACT)) as IERC20;
  //   const balanceBefore = await dai.connect(richDonor).balanceOf(RICH_DONOR);

  //   const mintValue = ethers.utils.parseUnits('3', DAI_DECIMALS);

  //   await dai.connect(richDonor).approve(subscription.address, mintValue);
  //   await subscription.connect(richDonor).subscribeForDeposit(mintValue);

  //   var tx = await subscription.connect(richDonor).executeDeposit(RICH_DONOR, 10, 3);
  //   var receipt = await tx.wait(0);
  //   console.log(`gasUsed by execute of 1 deposit: ${receipt.gasUsed}`);

  //   await dai.connect(richDonor).approve(subscription.address, mintValue.mul(2));
  //   for (var i = 2; i > 0; i--) {
  //     tx = await subscription.connect(richDonor).subscribeForDeposit(mintValue);
  //     await tx.wait(0);
  //   }
  //   tx = await subscription.connect(richDonor).executeDeposit(RICH_DONOR, 10, 3);
  //   receipt = await tx.wait(0);
  //   console.log(`gasUsed by execute of 2 deposits: ${receipt.gasUsed}`);

  //   await dai.connect(richDonor).approve(subscription.address, mintValue.mul(10));
  //   for (var i = 10; i > 0; i--) {
  //     tx = await subscription.connect(richDonor).subscribeForDeposit(mintValue);
  //     await tx.wait(0);
  //   }
  //   tx = await subscription.connect(richDonor).executeDeposit(RICH_DONOR, 10, 3);
  //   receipt = await tx.wait(0);
  //   console.log(`gasUsed by execute of 10 deposits: ${receipt.gasUsed}`);
  // });
});
