import { task } from 'hardhat/config';
import { loadPoolConfig, ConfigNames, getWethAddress } from '../../helpers/configuration';
import { ZERO_ADDRESS } from '../../helpers/constants';
import {
  getAddressById,
  getMarketAddressController,
  getLendingPoolConfiguratorProxy,
  getLendingPoolProxy,
} from '../../helpers/contracts-getters';
import { getParamPerNetwork } from '../../helpers/contracts-helpers';
import { verifyContract } from '../../helpers/etherscan-verification';
import { eNetwork, ICommonConfiguration, IReserveParams } from '../../helpers/types';

task('verify:tokens', 'Deploy oracles for dev enviroment')
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ verify, all, pool }, localDRE) => {
    await localDRE.run('set-DRE');
    const network = localDRE.network.name as eNetwork;
    const poolConfig = loadPoolConfig(pool);
    const { ReserveAssets, ReservesConfig, Names } = poolConfig as ICommonConfiguration;

    const addressesProvider = await getMarketAddressController();
    const lendingPoolProxy = await getLendingPoolProxy(await addressesProvider.getLendingPool());

    const lendingPoolConfigurator = await getLendingPoolConfiguratorProxy(
      await addressesProvider.getLendingPoolConfigurator()
    );

    const configs = Object.entries(ReservesConfig) as [string, IReserveParams][];
    for (const entry of Object.entries(getParamPerNetwork(ReserveAssets, network))) {
      const [token, tokenAddress] = entry;
      console.log(`- Verifying ${token} token related contracts`);
      const {
        stableDebtTokenAddress,
        variableDebtTokenAddress,
        depositTokenAddress,
        strategy,
      } = await lendingPoolProxy.getReserveData(tokenAddress);

      const tokenConfig = configs.find(([symbol]) => symbol === token);
      if (!tokenConfig) {
        throw `ReservesConfig not found for ${token} token`;
      }

      const {
        optimalUtilizationRate,
        baseVariableBorrowRate,
        variableRateSlope1,
        variableRateSlope2,
        stableRateSlope1,
        stableRateSlope2,
      } = tokenConfig[1].strategy;

      console.log;
      // Proxy Stable Debt
      console.log(`\n- Verifying Stable Debt Token proxy...\n`);
      await verifyContract(stableDebtTokenAddress, [lendingPoolConfigurator.address]);

      // Proxy Variable Debt
      console.log(`\n- Verifying  Debt Token proxy...\n`);
      await verifyContract(variableDebtTokenAddress, [lendingPoolConfigurator.address]);

      // Proxy Deposit Token
      console.log('\n- Verifying Deposit Token proxy...\n');
      await verifyContract(depositTokenAddress, [lendingPoolConfigurator.address]);

      // Strategy Rate
      console.log(`\n- Verifying Strategy rate...\n`);
      await verifyContract(strategy, [
        addressesProvider.address,
        optimalUtilizationRate,
        baseVariableBorrowRate,
        variableRateSlope1,
        variableRateSlope2,
        stableRateSlope1,
        stableRateSlope2,
      ]);

      const depositSymbol = `${Names.DepositSymbolPrefix}${token}`;
      const stableDebtSymbol = `${Names.StableDebtSymbolPrefix}${token}`;
      const variableDebtSymbol = `${Names.DepositSymbolPrefix}${token}`;

      const depositToken = await getAddressById(depositSymbol);
      const stableDebt = await getAddressById(stableDebtSymbol);
      const variableDebt = await getAddressById(variableDebtSymbol);

      const treasuryAddress = await addressesProvider.getTreasury();

      if (depositToken) {
        console.log('\n- Verifying agToken...\n');
        await verifyContract(depositToken, [
          lendingPoolProxy.address,
          tokenAddress,
          treasuryAddress,
          `${Names.DepositTokenNamePrefix} ${token}`,
          depositSymbol,
          ZERO_ADDRESS,
        ]);
      } else {
        console.error(`Skipping agToken verify for ${token}. Missing address at JSON DB.`);
      }
      if (stableDebt) {
        console.log('\n- Verifying StableDebtToken...\n');
        await verifyContract(stableDebt, [
          lendingPoolProxy.address,
          tokenAddress,
          `${Names.StableDebtTokenNamePrefix} ${token}`,
          stableDebtSymbol,
          ZERO_ADDRESS,
        ]);
      } else {
        console.error(`Skipping stable debt verify for ${token}. Missing address at JSON DB.`);
      }
      if (variableDebt) {
        console.log('\n- Verifying VariableDebtToken...\n');
        await verifyContract(variableDebt, [
          lendingPoolProxy.address,
          tokenAddress,
          `${Names.VariableDebtTokenNamePrefix} ${token}`,
          variableDebtSymbol,
          ZERO_ADDRESS,
        ]);
      } else {
        console.error(`Skipping variable debt verify for ${token}. Missing address at JSON DB.`);
      }
    }
  });
