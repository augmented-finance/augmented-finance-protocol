import { makeSuite, TestEnv } from '../helpers/make-suite';
import { ethers } from 'ethers';
import { compareRewardsAtAction, compareRewardsAtTransfer } from './data-helpers/reward';
import { timeLatest, increaseTimeAndMine, increaseTime } from '../helpers/misc-utils';
import { COOLDOWN_SECONDS, UNSTAKE_WINDOW } from '../helpers/constants';

const { expect } = require('chai');

makeSuite('StakedAave V2. Transfers', (testEnv: TestEnv) => {
  it('User 1 stakes 50 AAVE', async () => {
    const { stakedAaveV2, aaveToken, users } = testEnv;
    const amount = ethers.utils.parseEther('50');
    const staker = users[1];

    const actions = () => [
      aaveToken.connect(staker.signer).approve(stakedAaveV2.address, amount),
      stakedAaveV2.connect(staker.signer).stake(staker.address, amount),
    ];

    await compareRewardsAtAction(stakedAaveV2, staker.address, actions);
  });

  it('User 1 transfers 50 SAAVE to User 5', async () => {
    const { stakedAaveV2, users } = testEnv;
    const amount = ethers.utils.parseEther('50').toString();
    const sender = users[1];
    const receiver = users[5];

    await compareRewardsAtTransfer(stakedAaveV2, sender, receiver, amount, true, false);
  });

  it('User 5 transfers 50 SAAVE to himself', async () => {
    const { stakedAaveV2, users } = testEnv;
    const amount = ethers.utils.parseEther('50');
    const sender = users[5];
    await compareRewardsAtTransfer(stakedAaveV2, sender, sender, amount, true, true);
  });

  it('User 5 transfers 50 SAAVE to user 2, with rewards not enabled', async () => {
    const { stakedAaveV2, aaveToken, users } = testEnv;
    const amount = ethers.utils.parseEther('50');
    const sender = users[5];
    const receiver = users[2];

    // Configuration to disable emission
    const assetConfig = {
      emissionPerSecond: '0',
      totalStaked: '0',
    };

    await compareRewardsAtTransfer(
      stakedAaveV2,
      sender,
      receiver,
      amount,
      false,
      false,
      assetConfig
    );
  });

  it('User 4 stakes and transfers 50 SAAVE to user 2, with rewards not enabled', async () => {
    const { stakedAaveV2, aaveToken, users } = testEnv;
    const amount = ethers.utils.parseEther('50');
    const sender = users[3];
    const receiver = users[2];

    // Configuration to disable emission
    const assetConfig = {
      emissionPerSecond: '0',
      totalStaked: '0',
    };

    const actions = () => [
      aaveToken.connect(sender.signer).approve(stakedAaveV2.address, amount),
      stakedAaveV2.connect(sender.signer).stake(sender.address, amount),
    ];

    await compareRewardsAtAction(stakedAaveV2, sender.address, actions, false, assetConfig);
    await compareRewardsAtTransfer(
      stakedAaveV2,
      sender,
      receiver,
      amount,
      false,
      false,
      assetConfig
    );
  });
  it('Activate cooldown of User2, transfer entire amount from User2 to User3, cooldown of User2 should be reset', async () => {
    const { stakedAaveV2, aaveToken, users } = testEnv;
    const sender = users[2];
    const receiver = users[3];

    const amount = await stakedAaveV2.balanceOf(sender.address);

    // Configuration to disable emission
    const assetConfig = {
      emissionPerSecond: '0',
      totalStaked: '0',
    };

    await stakedAaveV2.connect(sender.signer).cooldown();
    const cooldownActivationTimestamp = await (await timeLatest()).toString();

    const cooldownTimestamp = await stakedAaveV2.stakersCooldowns(sender.address);
    expect(cooldownTimestamp.gt('0')).to.be.ok;
    expect(cooldownTimestamp.toString()).to.equal(cooldownActivationTimestamp);

    await compareRewardsAtTransfer(
      stakedAaveV2,
      sender,
      receiver,
      amount,
      false,
      false,
      assetConfig
    );

    // Expect cooldown time to reset after sending the entire balance of sender
    const cooldownTimestampAfterTransfer = await (
      await stakedAaveV2.stakersCooldowns(sender.address)
    ).toString();
    expect(cooldownTimestampAfterTransfer).to.equal('0');
  });

  it('Transfer balance from User 3 to user 2 cooldown  of User 2 should be reset if User3 cooldown expired', async () => {
    const { stakedAaveV2, aaveToken, users } = testEnv;
    const amount = ethers.utils.parseEther('10');
    const sender = users[3];
    const receiver = users[2];

    // Configuration to disable emission
    const assetConfig = {
      emissionPerSecond: '0',
      totalStaked: '0',
    };

    // First enable cooldown for sender
    await stakedAaveV2.connect(sender.signer).cooldown();

    // Then enable cooldown for receiver
    await aaveToken.connect(receiver.signer).approve(stakedAaveV2.address, amount);
    await stakedAaveV2.connect(receiver.signer).stake(receiver.address, amount);
    await stakedAaveV2.connect(receiver.signer).cooldown();
    const receiverCooldown = await stakedAaveV2.stakersCooldowns(sender.address);

    // Increase time to an invalid time for cooldown
    await increaseTimeAndMine(
      receiverCooldown.add(COOLDOWN_SECONDS).add(UNSTAKE_WINDOW).add(1).toNumber()
    );
    // Transfer staked aave from sender to receiver, it will also transfer the cooldown status from sender to the receiver
    await compareRewardsAtTransfer(
      stakedAaveV2,
      sender,
      receiver,
      amount,
      false,
      false,
      assetConfig
    );

    // Receiver cooldown should be set to zero
    const stakerCooldownTimestampBefore = await stakedAaveV2.stakersCooldowns(receiver.address);
    expect(stakerCooldownTimestampBefore.eq(0)).to.be.ok;
  });

  it('Transfer balance from User 3 to user 2, cooldown of User 2 should be the same if User3 cooldown is less than User2 cooldown', async () => {
    const { stakedAaveV2, users } = testEnv;
    const amount = ethers.utils.parseEther('10');
    const sender = users[3];
    const receiver = users[2];

    // Configuration to disable emission
    const assetConfig = {
      emissionPerSecond: '0',
      totalStaked: '0',
    };

    // Enable cooldown for sender
    await stakedAaveV2.connect(sender.signer).cooldown();
    await increaseTime(5);

    // Enable enable cooldown for receiver
    await stakedAaveV2.connect(receiver.signer).cooldown();
    const receiverCooldown = await (
      await stakedAaveV2.stakersCooldowns(receiver.address)
    ).toString();

    // Transfer staked aave from sender to receiver, it will also transfer the cooldown status from sender to the receiver
    await compareRewardsAtTransfer(
      stakedAaveV2,
      sender,
      receiver,
      amount,
      false,
      false,
      assetConfig
    );

    // Receiver cooldown should be like before
    const receiverCooldownAfterTransfer = await (
      await stakedAaveV2.stakersCooldowns(receiver.address)
    ).toString();
    expect(receiverCooldownAfterTransfer).to.be.equal(receiverCooldown);
  });
});
