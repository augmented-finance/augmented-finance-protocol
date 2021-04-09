import chai from 'chai';
import { solidity } from 'ethereum-waffle';
import { makeSuite, TestEnv } from '../test-aave/helpers/make-suite';

chai.use(solidity);
const { expect } = chai;

makeSuite('Rewards test suite', (testEnv: TestEnv) => {
  const { deployer, users } = testEnv;

  it('Should do something', async () => {
    console.log('Do something');
    // console.log(`Admin address: ${deployer.address.toString()}`);
    // console.log(`User address: ${users[0].address.toString()}`);

    // expect(deployer.address).to3.properAddress;
  });
});
