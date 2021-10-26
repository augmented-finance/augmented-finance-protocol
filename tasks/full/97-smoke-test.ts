import { task } from 'hardhat/config';
import { eEthereumNetwork, eNetwork, tEthereumAddress } from '../../helpers/types';
import { ConfigNames, loadPoolConfig } from '../../helpers/configuration';
import { falsyOrZeroAddress, getFirstSigner, waitTx } from '../../helpers/misc-utils';
import {
  getDecayingTokenLockerProxy,
  getIErc20Detailed,
  getLendingPoolProxy,
  getOracleRouter,
  getProtocolDataProvider,
  getTreasuryProxy,
} from '../../helpers/contracts-getters';
import { AccessFlags } from '../../helpers/access-flags';
import { getDeployAccessController } from '../../helpers/deploy-helpers';
import { ONE_YEAR, USD_ADDRESS } from '../../helpers/constants';

task('full:smoke-test', 'Does smoke tests of the deployed contracts')
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addFlag('ignoreCalc')
  .setAction(async ({ pool, ignoreCalc }, DRE) => {
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

    console.log('\nCheck getReserveList');
    const lp = await getLendingPoolProxy(await addressProvider.getAddress(AccessFlags.LENDING_POOL));
    const reserveList = await lp.getReservesList();
    console.log('Reserves: ', reserveList);

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

    const pricingTokens: string[] = [];
    const pricingTokenOverlyingNames: string[] = [];

    console.log('\nCheck getAllTokenDescriptions');
    const allTokenDesc = await dataHelper.getAllTokenDescriptions(true);
    {
      const pricingTokenSet = new Set<string>();
      console.log('All tokens:');
      allTokenDesc.tokens.slice(0, allTokenDesc.tokenCount.toNumber()).map((x) => {
        if (!falsyOrZeroAddress(x.priceToken) && !pricingTokenSet.has(x.priceToken.toLocaleLowerCase())) {
          pricingTokens.push(x.priceToken);
          pricingTokenOverlyingNames.push(x.tokenSymbol);
          pricingTokenSet.add(x.priceToken.toLocaleLowerCase());
        }
        console.log(
          ` ${x.tokenSymbol} (${x.tokenType} ${x.active} ${x.decimals}):\t${x.token} ${x.underlying} ${x.priceToken}`
        );
      });
    }

    const deployer = await getFirstSigner();
    const userAddr = deployer.address;

    {
      console.log('\nCheck getAllTokens');
      const allTokens = await dataHelper.getAllTokens(true);

      const allTokensList0 = allTokens.tokens.slice(0, allTokens.tokenCount.toNumber());
      const allTokensTypes0 = allTokens.tokenTypes.slice(0, allTokens.tokenCount.toNumber());

      const allTokensList1 = allTokenDesc.tokens.slice(0, allTokenDesc.tokenCount.toNumber());

      if (allTokensList0.length != allTokensList1.length) {
        throw `inconsisten length: getAllTokens = ${allTokensList0.length}, getAllTokenDescriptions = ${allTokensList1.length}`;
      }
      for (let i = 0; i < allTokensList0.length; i++) {
        if (allTokensList0[i] != allTokensList1[i].token) {
          throw `inconsisten token at index ${i}`;
        }
        if (allTokensTypes0[i] != allTokensList1[i].tokenType) {
          throw `inconsisten token type at index ${i}`;
        }
      }

      console.log('\nCheck batchBalanceOf');
      const balances = await dataHelper.batchBalanceOf([userAddr], allTokensList0, allTokensTypes0, 0);
    }

    {
      pricingTokens.push(USD_ADDRESS);
      pricingTokenOverlyingNames.push('USD');

      console.log('\nCheck ', pricingTokens.length, 'listed prices');

      const po = await getOracleRouter(await addressProvider.getAddress(AccessFlags.PRICE_ORACLE));

      let allPrices = true;
      await Promise.all(
        pricingTokens.map(async (value, index) => {
          try {
            await po.getAssetPrice(value);
          } catch {
            allPrices = false;
            console.log('Failed to get a price:', pricingTokenOverlyingNames[index], value);
          }
        })
      );

      if (!allPrices) {
        throw 'Some prices are missing';
      }
    }

    console.log('\nCheck getReservesData');
    const rd = await dataHelper.getReservesData(userAddr);
    const [aggregatedData, userData, x] = [rd[0], rd[1], rd[2]];

    const checkReserve = async (reserveName: string, reserveAddr: tEthereumAddress) => {
      console.log('\nCheck getUserReserveData on reserve', reserveName);
      await dataHelper.getUserReserveData(reserveAddr, userAddr);

      console.log('\nCheck getReserveData on reserve', reserveName);
      await dataHelper.getReserveData(reserveAddr);

      console.log('\nCheck getReserveConfigurationData on reserve', reserveName);
      await dataHelper.getReserveConfigurationData(reserveAddr);
    };

    if (reserveList.length > 0) {
      await checkReserve('#0', reserveList[0]);

      let i = reserveList.length - 1;
      await checkReserve(`#${i}`, reserveList[i]);
    }

    {
      const agf = await getIErc20Detailed(await addressProvider.getAddress(AccessFlags.REWARD_TOKEN));
      const treasury = await getTreasuryProxy(await addressProvider.getAddress(AccessFlags.TREASURY));
      const balance = await agf.balanceOf(treasury.address);
      console.log('Found', balance.div(1e15).toNumber() / 1e3, ' AGF in the treasury');
      if (balance.gt(0) && network == eEthereumNetwork.hardhat) {
        await waitTx(treasury.transferToken(agf.address, deployer.address, balance));
        console.log('Transferred from treasury to deployer: ', deployer.address);

        const locker = await getDecayingTokenLockerProxy(
          await addressProvider.getAddress(AccessFlags.REWARD_STAKE_TOKEN)
        );
        await waitTx(agf.approve(locker.address, balance.div(2)));
        await waitTx(locker.lock(balance.div(2), ONE_YEAR, 0));
        console.log('Locked half of AGF for 1 year');
      }
    }

    if (!ignoreCalc) {
      console.log('\nCheck calc-apy');
      await DRE.run('helper:calc-apy', { ctl: addressProvider.address, user: userAddr, quiet: true });
    }

    console.log('');
  });
