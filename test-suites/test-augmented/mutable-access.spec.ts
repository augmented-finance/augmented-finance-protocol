import { makeSuite, TestEnv } from './helpers/make-suite';
import { eContractid } from '../../helpers/types';
import { Contract, Signer } from 'ethers';
import { verifyContractMutableAccess } from '../../helpers/method-checker';
import { falsyOrZeroAddress, getFromJsonDb } from '../../helpers/misc-utils';
import { getContractGetterById } from '../../helpers/contracts-mapper';

makeSuite('Mutable methods', (testEnv: TestEnv) => {
  let user: Signer;

  before(() => {
    user = testEnv.users[1].signer;
    console.log('user', testEnv.users[1].address, testEnv.users[0].address);
  });

  //  it.skip('test stub', async function () {});

  for (const contractType in eContractid) {
    const [contractId, getter] = getContractGetterById(contractType);
    if (getter == undefined) {
      continue;
    }

    // it(contractType, async function () {
    //   const entry = getFromJsonDb(contractType);
    //   if (falsyOrZeroAddress(entry?.address)) {
    //     this.skip();
    //   }
    //   const subj = (await getter(entry!.address)) as Contract;
    //   await verifyContractMutableAccess(user, subj, contractId, true);
    // });
  }
});
