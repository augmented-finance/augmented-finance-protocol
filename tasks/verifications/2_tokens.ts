import { task } from 'hardhat/config';
import {
  loadPoolConfig,
  ConfigNames,
  getWethAddress,
  getTreasuryAddress,
} from '../../helpers/configuration';
import { ZERO_ADDRESS } from '../../helpers/constants';
import {
  getAddressById,
  getLendingPool,
  getMarketAddressController,
  getLendingPoolConfiguratorProxy,
} from '../../helpers/contracts-getters';
import { getParamPerNetwork } from '../../helpers/contracts-helpers';
import { verifyContract } from '../../helpers/etherscan-verification';
import { getFirstSigner } from '../../helpers/misc-utils';
import { eNetwork, ICommonConfiguration, IReserveParams } from '../../helpers/types';
import { LendingPoolConfiguratorFactory, LendingPoolFactory } from '../../types';

task('verify:tokens', 'Deploy oracles for dev enviroment')
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ verify, all, pool }, localDRE) => {
    await localDRE.run('set-DRE');
    const network = localDRE.network.name as eNetwork;
    const poolConfig = loadPoolConfig(pool);
    const { ReserveAssets, ReservesConfig } = poolConfig as ICommonConfiguration;
    const treasuryAddress = await getTreasuryAddress(poolConfig);

    const addressesProvider = await getMarketAddressController();
    const lendingPoolProxy = LendingPoolFactory.connect(
      await addressesProvider.getLendingPool(),
      await getFirstSigner()
    );

    const lendingPoolConfigurator = LendingPoolConfiguratorFactory.connect(
      await addressesProvider.getLendingPoolConfigurator(),
      await getFirstSigner()
    );

    const configs = Object.entries(ReservesConfig) as [string, IReserveParams][];
    for (const entry of Object.entries(getParamPerNetwork(ReserveAssets, network))) {
      const [token, tokenAddress] = entry;
      console.log(`- Verifying ${token} token related contracts`);
      const {
        stableDebtTokenAddress,
        variableDebtTokenAddress,
        aTokenAddress,
        interestRateStrategyAddress,
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

      // Proxy aToken
      console.log('\n- Verifying aToken proxy...\n');
      await verifyContract(aTokenAddress, [lendingPoolConfigurator.address]);

      // Strategy Rate
      console.log(`\n- Verifying Strategy rate...\n`);
      await verifyContract(interestRateStrategyAddress, [
        addressesProvider.address,
        optimalUtilizationRate,
        baseVariableBorrowRate,
        variableRateSlope1,
        variableRateSlope2,
        stableRateSlope1,
        stableRateSlope2,
      ]);

      const stableDebt = await getAddressById(`stableDebt${token}`);
      const variableDebt = await getAddressById(`variableDebt${token}`);
      const aToken = await getAddressById(`ag${token}`);

      if (aToken) {
        console.log('\n- Verifying agToken...\n');
        await verifyContract(aToken, [
          lendingPoolProxy.address,
          tokenAddress,
          treasuryAddress,
          `Augmented interest ${token}`,
          `ag${token}`,
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
          `Augmented stable debt ${token}`,
          `stableDebt${token}`,
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
          `Augmented variable debt ${token}`,
          `variableDebt${token}`,
          ZERO_ADDRESS,
        ]);
      } else {
        console.error(`Skipping variable debt verify for ${token}. Missing address at JSON DB.`);
      }
    }
  });
