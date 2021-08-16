import { task } from 'hardhat/config';
import { eNetwork } from '../../helpers/types';
import { ConfigNames, loadPoolConfig } from '../../helpers/configuration';
import { falsyOrZeroAddress, getFirstSigner } from '../../helpers/misc-utils';
import { getLendingPoolProxy, getProtocolDataProvider } from '../../helpers/contracts-getters';
import { AccessFlags } from '../../helpers/access-flags';
import { getDeployAccessController } from '../../helpers/deploy-helpers';

task('full:smoke-test', 'Does a smoke test of the deployed contracts')
  .addFlag('verify', 'Verify contracts at Etherscan')
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ verify, pool }, DRE) => {
    await DRE.run('set-DRE');

    const network = <eNetwork>DRE.network.name;
    const poolConfig = loadPoolConfig(pool);

    const [freshStart, continuation, addressProvider] = await getDeployAccessController();

    const dataHelperAddress = await addressProvider.getAddress(AccessFlags.DATA_HELPER);
    if (falsyOrZeroAddress(dataHelperAddress)) {
      console.log('Data Helper is unavailable, configuration is incomplete');
      return;
    }
    const dataHelper = await getProtocolDataProvider(dataHelperAddress);

    {
      console.log('\nCheck getReserveList');
      const lp = await getLendingPoolProxy(await addressProvider.getAddress(AccessFlags.LENDING_POOL));
      console.log('Reserves: ', await lp.getReservesList());
    }

    {
      console.log('\nCheck getAddresses');
      const addresses = await dataHelper.getAddresses();
      let hasZeros = false;
      for (const [name, addr] of Object.entries(addresses)) {
        if (falsyOrZeroAddress(addr)) {
          console.log('Unexpected zero address: ', name);
          hasZeros = true;
        }
      }
      if (hasZeros) {
        throw 'Unexpected zero address(es)';
      }
    }

    console.log('\nCheck getAllTokenDescriptions');
    const allTokens = await dataHelper.getAllTokenDescriptions(true);
    console.log('All tokens:');
    allTokens.tokens.slice(0, allTokens.tokenCount.toNumber()).map((x) => {
      console.log(
        ` ${x.tokenSymbol} (${x.tokenType} ${x.active} ${x.decimals}):\t${x.token} ${x.underlying} ${x.priceToken}`
      );
    });

    console.log('\nCheck getReservesData');
    const rd = await dataHelper.getReservesData((await getFirstSigner()).address);
    const [aggregatedData, userData, x] = [rd[0], rd[1], rd[2]];

    console.log('');
  });
