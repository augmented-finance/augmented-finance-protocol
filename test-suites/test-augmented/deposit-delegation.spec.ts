import { expect } from 'chai';
import { ethers } from 'ethers';
import { ProtocolErrors } from '../../helpers/types';
import { makeSuite, TestEnv } from './helpers/make-suite';
import { ConfigNames, loadPoolConfig } from '../../helpers/configuration';
import {
  deployMintableDelegationERC20,
  deployMockDelegationAwareDepositToken,
} from '../../helpers/contracts-deployments';
import { DelegationAwareDepositToken } from '../../types';
import { MintableDelegationERC20 } from '../../types';

const { parseEther } = ethers.utils;

makeSuite('DepositToken: underlying delegation', (testEnv: TestEnv) => {
  const poolConfig = loadPoolConfig(ConfigNames.Commons);
  let delegationToken = <DelegationAwareDepositToken>{};
  let delegationERC20 = <MintableDelegationERC20>{};

  it('Deploys a new MintableDelegationERC20 and a DelegationAwareDepositToken', async () => {
    const { pool, addressesProvider } = testEnv;

    delegationERC20 = await deployMintableDelegationERC20(['DEL', 'DEL', '18']);

    delegationToken = await deployMockDelegationAwareDepositToken(
      [
        pool.address,
        delegationERC20.address,
        await addressesProvider.getTreasury(),
        'aDEL',
        'aDEL',
      ],
      false
    );

    console.log((await delegationToken.decimals()).toString());
  });

  it('Tries to delegate with the caller not being the admin', async () => {
    const { users } = testEnv;

    await expect(
      delegationToken.connect(users[1].signer).delegateUnderlyingTo(users[2].address)
    ).to.be.revertedWith(ProtocolErrors.CALLER_NOT_POOL_ADMIN);
  });

  it('Tries to delegate to user 2', async () => {
    const { users } = testEnv;

    await delegationToken.delegateUnderlyingTo(users[2].address);

    const delegateeAddress = await delegationERC20.delegatee();

    expect(delegateeAddress).to.be.equal(users[2].address);
  });
});
