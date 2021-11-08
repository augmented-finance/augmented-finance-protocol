import { BigNumber } from '@ethersproject/bignumber';
import { subtask, types } from 'hardhat/config';
import { AccessFlags } from '../../helpers/access-flags';
import { DAY, MAX_LOCKER_WEEKS, RAY, USD_ADDRESS, ZERO_ADDRESS } from '../../helpers/constants';
import {
  getIErc20Detailed,
  getIRevision,
  getMarketAddressController,
  getOracleRouter,
  getProtocolDataProvider,
  getRewardConfiguratorProxy,
} from '../../helpers/contracts-getters';
import { falsyOrZeroAddress, getSignerN } from '../../helpers/misc-utils';
import { tEthereumAddress } from '../../helpers/types';
import { promiseAllBatch } from './utils';

enum TokenType {
  PoolAsset,
  Deposit,
  VariableDebt,
  StableDebt,
  Stake,
  Reward,
  RewardStake,
  HiddenStake,
}

subtask('helper:calc-apy', 'Calculates current APYs')
  .addParam('ctl', 'Address of MarketAddressController', ZERO_ADDRESS, types.string)
  .addParam('user', 'User address to calc APY', ZERO_ADDRESS, types.string)
  .addFlag('quiet')
  .setAction(async ({ ctl, user: userAddr, quiet }, DRE) => {
    if (falsyOrZeroAddress(ctl)) {
      throw new Error('Unknown MarketAddressController');
    }
    if (userAddr.length == 1) {
      userAddr = (await getSignerN(userAddr)).address;
    } else if (falsyOrZeroAddress(userAddr)) {
      userAddr = ZERO_ADDRESS;
    }

    const ac = await getMarketAddressController(ctl);
    const dp = await getProtocolDataProvider(await ac.getAddress(AccessFlags.DATA_HELPER));

    const poolInfo = new Map<
      string,
      {
        poolName: string;
        poolRate: BigNumber;
        poolToken: string;
      }
    >();

    const addresses = await dp.getAddresses();

    if (!quiet) {
      console.log('Access Controller:', ac.address);
      console.log('Data Helper:', dp.address);
      console.log('Addresses:', addresses);
    }

    const priceCurrency = USD_ADDRESS;
    const priceCurrencyName = 'USD';
    const priceCurrencyDecimals = 8;

    const basePriceDecimals = await (async () => {
      const po = await getOracleRouter(addresses.priceOracle);
      let quoteValue = '';
      let quoteToken = '';
      try {
        const quote = await po.getQuoteAndValue();
        quoteToken = quote[0];
        quoteValue = quote[1].toString();
      } catch (err) {
        // all prices are nominated in ETH, hence decimals = 18
        console.log('Price quote: WETH');
        return 18;
      }
      if (
        quoteValue.length > 0 &&
        BigNumber.from(10)
          .pow(quoteValue.length - 1)
          .eq(quoteValue)
      ) {
        console.log('Price quote: decimals =', quoteValue.length - 1, quoteToken);
        return quoteValue.length - 1;
      }
      throw new Error('unsupported quote value: ' + quoteValue);
    })();

    {
      const rw = await getRewardConfiguratorProxy(addresses.rewardConfigurator);

      const poolList: string[] = [];
      for (const poolAddr of await rw.list()) {
        if (!falsyOrZeroAddress(poolAddr)) {
          poolList.push(poolAddr);
        }
      }
      const poolParams = await rw.getPoolParams(poolList);
      for (let i = 0; i < poolList.length; i++) {
        poolInfo.set(poolList[i].toLowerCase(), {
          poolName: '',
          poolRate: poolParams.rates[i],
          poolToken: '',
        });
      }
      console.log('Found', poolInfo.size, 'pool(s)');
    }

    const tokenInfo = new Map<
      string,
      {
        token: string;
        priceToken: string;
        rewardPool: string;
        tokenSymbol: string;
        underlying: string;
        decimals: number;
        tokenType: number;
        active: boolean;
        frozen: boolean;
        totalSupply: BigNumber;
      }
    >();

    const priceInfo = new Map<
      string,
      {
        tokenName: string;
        decimals: number;
        price: BigNumber;
      }
    >();

    const tokenAddrList: tEthereumAddress[] = [];
    const tokenTypeList: number[] = [];

    {
      const requests: Promise<void>[] = [];

      const descs = await dp.getAllTokenDescriptions(true);
      for (let i = descs.tokenCount.toNumber(); i > 0; i--) {
        let token = { ...descs.tokens[i - 1] };
        const key = token.token.toLowerCase();
        tokenInfo.set(key, { ...token, totalSupply: BigNumber.from(0) });
        const tokenAddr = token.token;

        tokenAddrList.push(tokenAddr);
        tokenTypeList.push(token.tokenType);

        // TODO this requires a better function of Data Provider
        requests.push(
          (async () => {
            const t = await getIErc20Detailed(tokenAddr);
            tokenInfo.get(key)!.totalSupply = await t.totalSupply();
          })()
        );

        if (!falsyOrZeroAddress(token.priceToken)) {
          priceInfo.set(token.priceToken, {
            tokenName: token.tokenSymbol,
            decimals: basePriceDecimals,
            price: BigNumber.from(0),
          });
        }

        if (!falsyOrZeroAddress(token.rewardPool)) {
          const pool = poolInfo.get(token.rewardPool.toLowerCase());
          if (pool == undefined) {
            if (token.rewardPool == token.token) {
              // this is an unconfigured self-pool
              continue;
            }
            throw new Error(`Unknown pool of ${token}`);
          }

          let name = token.tokenSymbol;
          try {
            const rev = await (await getIRevision(token.rewardPool)).callStatic.REVISION();
            name += '-' + rev.toString();
          } catch (error: any) {
            if ((<string>error.message).indexOf('UNPREDICTABLE_GAS_LIMIT') < 0) {
              throw error;
            }
          }

          pool.poolName = name + ' Pool';
          pool.poolToken = key;
        }
      }
      await promiseAllBatch(requests);

      console.log('Found', tokenInfo.size, 'token(s)');
    }

    const agfToken = tokenInfo.get(addresses.rewardToken.toLowerCase())!;
    const xagfToken = tokenInfo.get(addresses.rewardStake.toLowerCase())!;

    {
      priceInfo.set(priceCurrency, {
        tokenName: priceCurrencyName,
        decimals: priceCurrencyDecimals,
        price: BigNumber.from(0),
      });

      console.log('Required', priceInfo.size, 'price(s)');

      const po = await getOracleRouter(addresses.priceOracle);
      const priceList: string[] = [];
      priceInfo.forEach((value, key: string) => {
        priceList.push(key);
      });

      let allPrices = true;
      try {
        const prices = await po.getAssetsPrices(priceList);
        for (let i = 0; i < priceList.length; i++) {
          priceInfo.get(priceList[i])!.price = prices[i];
        }
      } catch {
        allPrices = false;
        for (let i = 0; i < priceList.length; i++) {
          const pi = priceInfo.get(priceList[i])!;
          try {
            pi.price = await po.getAssetPrice(priceList[i]);
          } catch {
            console.log('Failed to get a price:', pi.tokenName, priceList[i]);
          }
        }
      }
      if (allPrices) {
        console.log('Found all prices');
      }
    }

    if (!quiet) {
      const { 0: reserves, 1: userReserves, 2: usdPrice } = await dp.getReservesData(ZERO_ADDRESS);

      console.log('\nLending pools:');
      for (let i = 0; i < reserves.length; i++) {
        const reserve = reserves[i];
        console.log(
          reserve.symbol,
          reserve.decimals.toNumber(),
          `\tDeposit: ${formatFixed(reserve.liquidityRate, 27 - 2, 4)}%`,
          `\tVariable: ${formatFixed(reserve.variableBorrowRate, 27 - 2, 4)}%`,
          `\tStable: ${formatFixed(reserve.stableBorrowRate, 27 - 2, 4)}%`,
          `\tLiquidity: ${formatFixed(reserve.availableLiquidity, reserve.decimals.toNumber(), 6)}`,
          `\tDebt: ${formatFixed(
            reserve.totalScaledVariableDebt.mul(reserve.variableBorrowIndex).div(RAY),
            reserve.decimals.toNumber(),
            6
          )}`
        );
      }
    }

    const agfPrice = priceInfo.get(agfToken.priceToken)!;
    const xagfAddr = xagfToken.token.toLowerCase();

    {
      console.log('\nRewards and boosts');

      let totalValue = BigNumber.from(0);
      let totalRate = BigNumber.from(0);
      let boostRate = BigNumber.from(0);
      const totalDecimals = basePriceDecimals;
      const totalExp = powerOf10(totalDecimals);

      poolInfo.forEach((value, key) => {
        if (value.poolToken === '') {
          // ignore special pools
          return;
        }

        const annualRate = perAnnum(value.poolRate);
        totalRate = totalRate.add(annualRate);
        if (value.poolToken == xagfAddr) {
          boostRate = boostRate.add(annualRate);
        }
        const token = tokenInfo.get(value.poolToken)!;

        if (token.totalSupply.eq(0)) {
          console.log(
            '\t',
            value.poolName,
            '\t',
            formatFixed(annualRate, agfToken.decimals, 4),
            'AGF p.a.;\tReward APY:\tINF %'
          );
          return;
        }

        const tokenPrice = value.poolToken == xagfAddr ? agfPrice : priceInfo.get(token.priceToken)!;
        if (tokenPrice == undefined) {
          console.log('\t', value.poolName, 'unknown price', token.priceToken);
          return;
        }

        const tokenValue = token.totalSupply.mul(tokenPrice.price);
        const tokenValueDecimals = token.decimals + tokenPrice.decimals;
        totalValue = totalValue.add(tokenValue.mul(totalExp).div(powerOf10(tokenValueDecimals)));

        console.log(
          '\t',
          value.poolName,
          '\t',
          formatFixed(annualRate, agfToken.decimals, 4),
          'AGF p.a.;\tReward APY:\t',
          tokenValue.eq(0)
            ? 'INF'
            : formatFixed(
                annualRate
                  .mul(agfPrice.price)
                  .mul(10 ** 4) // keep precision for 4 digits => 100.00%
                  .div(tokenValue),
                agfToken.decimals + agfPrice.decimals + 4 - tokenValueDecimals - 2,
                2
              ),
          '%'
        );
      });

      const maxBoostAPY = (v: BigNumber) =>
        totalValue.eq(0)
          ? 'INF'
          : formatFixed(
              v
                .mul(agfPrice.price)
                .mul(10 ** 4) // keep precision for 4 digits => 100.00%
                .div(totalValue),
              agfToken.decimals + agfPrice.decimals + 4 - totalDecimals - 2,
              2
            );
      console.log(
        '\n\tAvg Max APY',
        formatFixed(totalRate, agfToken.decimals, 4),
        'AGF p.a.;\tAPY%:\t',
        maxBoostAPY(totalRate),
        '%'
      );
      console.log(
        '\tAvg Boost APY',
        formatFixed(boostRate, agfToken.decimals, 4),
        'AGF p.a.;\tAPY%:\t',
        maxBoostAPY(boostRate),
        '%'
      );
    }

    let xagfBalance = BigNumber.from(0);

    if (!falsyOrZeroAddress(userAddr)) {
      console.log('\nBalances of user:', userAddr);

      const currencyPrice = priceInfo.get(priceCurrency)!;
      console.log('\t ETH', '\t@', formatFixed(currencyPrice.price, currencyPrice.decimals, 6), priceCurrencyName);

      const rewardedBalanceValues = new Map<string, BigNumber>();

      let totalValue = BigNumber.from(0);
      const totalDecimals = basePriceDecimals;
      const totalExp = powerOf10(totalDecimals);

      {
        // TODO use rewardedBalanceOf() for pool and stake tokens
        const allBalances = await dp.batchBalanceOf([userAddr], tokenAddrList, tokenTypeList, 0);

        for (let i = allBalances.length; i > 0; ) {
          i--;
          const tokenBalances = allBalances[i];
          const tokenKey = tokenAddrList[i].toLowerCase();
          const token = tokenInfo.get(tokenKey)!;

          let rewardedBalance = tokenBalances.rewardedBalance;
          if (rewardedBalance.eq(0) && tokenTypeList[i] == 0 + TokenType.RewardStake) {
            xagfBalance = tokenBalances.balance;
            rewardedBalance = tokenBalances.underlyingBalance;
          }
          if (rewardedBalance.eq(0)) {
            continue;
          }

          const balanceV = formatFixed(tokenBalances.balance, token.decimals, 4);
          const rewardedV = formatFixed(rewardedBalance, token.decimals, 4);
          const price = tokenKey == xagfAddr ? agfPrice : priceInfo.get(token.priceToken)!;
          if (price === undefined) {
            console.log('\t', token.tokenSymbol, '\t', balanceV, '/', rewardedV);
            continue;
          }

          const rewardedValue = rewardedBalance.mul(price.price);
          rewardedBalanceValues.set(tokenKey, rewardedValue);
          totalValue = totalValue.add(rewardedValue.mul(totalExp).div(powerOf10(price.decimals + token.decimals)));

          const priceV = formatFixed(
            price.price.mul(currencyPrice.price).div(BigNumber.from(10).pow(currencyPrice.decimals)),
            price.decimals,
            6
          );
          const totalV = formatFixed(
            rewardedValue.mul(currencyPrice.price),
            token.decimals + price.decimals + currencyPrice.decimals,
            4
          );
          console.log(
            '\t',
            token.tokenSymbol,
            '\t',
            balanceV,
            '/',
            rewardedV,
            '\t;\t',
            totalV,
            '\t@',
            priceV,
            priceCurrencyName
          );
        }
      }

      console.log('\nRewards of user:', userAddr);
      const { 0: explained, 1: explainedAt } = await dp.explainReward(userAddr, 10);
      console.log(
        '\tClaimable:',
        formatFixed(explained.amountClaimable, agfToken.decimals, 4),
        '\tExtra:',
        formatFixed(explained.amountExtra, agfToken.decimals, 4),
        '\tBoostLimit:',
        formatFixed(explained.boostLimit, agfToken.decimals, 4),
        '\tMaxBoost:',
        formatFixed(explained.maxBoost, agfToken.decimals, 4),
        '\tContributing Pools:',
        explained.allocations.length
      );

      const [boostAlloc, boostMax] = explained.boostLimit.gt(explained.maxBoost)
        ? [explained.maxBoost, explained.boostLimit]
        : [explained.boostLimit, explained.maxBoost];

      let minBoostBP = 0;

      console.log('\tRewards by pools:');
      for (const poolAlloc of explained.allocations) {
        const pool = poolInfo.get(poolAlloc.pool.toLowerCase())!;
        const tokenKey = pool.poolToken.toLowerCase();
        const balanceValue = rewardedBalanceValues.get(tokenKey) || BigNumber.from(0);
        if (balanceValue.eq(0)) {
          continue;
        }

        const token = tokenInfo.get(tokenKey)!;
        const tokenPrice = tokenKey == xagfAddr ? agfPrice : priceInfo.get(token.priceToken)!;

        let _allocAmount = poolAlloc.amount;
        if (poolAlloc.rewardType == 1 /* BoostReward */) {
          minBoostBP += poolAlloc.factor;
          _allocAmount = _allocAmount.mul(poolAlloc.factor).div(10000);
        }

        const allocPeriod = explainedAt - poolAlloc.since;
        const allocRate = perAnnum(_allocAmount).div(allocPeriod);
        console.log(
          '\t',
          pool.poolName,
          '\tBoost Factor:',
          poolAlloc.factor / 10 ** 2,
          '%\tType:',
          poolAlloc.rewardType,
          '\tReward APY:',
          formatFixed(
            allocRate
              .mul(agfPrice.price)
              .mul(10 ** 4) // keep precision for 4 digits => 100.00%
              .div(balanceValue),
            agfToken.decimals + agfPrice.decimals + 4 - (token.decimals + tokenPrice.decimals) - 2,
            2
          ),
          '%\tSince:',
          allocPeriod,
          's\tReward:',
          formatFixed(_allocAmount, agfToken.decimals, 4)
        );
      }

      const protocolStartedAt = new Date('2021-10-02').getTime() / 1000;
      const boostDuration = explainedAt - (explained.latestClaimAt > 0 ? explained.latestClaimAt : protocolStartedAt);

      if (boostDuration > 0 && totalValue.gt(0)) {
        const adjustment = explained.maxBoost.mul(minBoostBP).div(10000);

        const formatBoostAPY = (v: BigNumber) =>
          formatFixed(
            perAnnum(v)
              .mul(agfPrice.price)
              .mul(10 ** 4) // keep precision for 4 digits => 100.00%
              .div(totalValue)
              .div(boostDuration),
            agfToken.decimals + agfPrice.decimals + 4 - totalDecimals - 2,
            2
          );

        console.log('\tCurrent boost APY:', formatBoostAPY(boostAlloc.sub(adjustment)), '%');
        console.log('\tMax boost APY:', formatBoostAPY(boostMax.sub(adjustment)), '%');

        {
          const boostDifference = boostAlloc.eq(0)
            ? boostMax.mul(0)
            : boostMax
                .mul(10 ** 4)
                .div(boostAlloc)
                .toNumber() /
              10 ** 2;

          const recommendedBoost = 400; // %
          const recommendedBoostDuration = 52; // weeks

          const adviceTolerance = 120; // %
          if (boostDifference > adviceTolerance) {
            if (explained.boostLimit.gt(boostAlloc)) {
              console.log('\n\tGet upto', boostDifference, '% more boost rewards by locking AGF\n');

              let boostTarget = explained.maxBoost.mul(recommendedBoost).div(100);

              if (boostTarget.gt(explained.boostLimit)) {
                if (minBoostBP > 0) {
                  const workLimit = explained.boostLimit.sub(adjustment);
                  const maxTarget = workLimit.mul(10000 + minBoostBP).div(10000);
                  if (boostTarget.gt(maxTarget)) {
                    boostTarget = maxTarget;
                  }
                } else {
                  boostTarget = explained.boostLimit;
                }
              }
              const boostTargetPct = boostTarget.mul(100).div(explained.maxBoost).toNumber();
              if (boostTargetPct >= adviceTolerance) {
                const moreAGF = xagfBalance
                  .mul(boostTargetPct - 100)
                  .div(100)
                  .mul(MAX_LOCKER_WEEKS * 2 + 1)
                  .div(recommendedBoostDuration);

                console.log(
                  '\tGet',
                  boostTargetPct,
                  '% increase of boost rewards over',
                  recommendedBoostDuration,
                  'week(s) by locking',
                  formatFixed(moreAGF, agfToken.decimals, 4),
                  'AGF for',
                  recommendedBoostDuration,
                  'week(s)\n'
                );
              }
            } else if (explained.maxBoost.gt(boostAlloc)) {
              console.log(
                '\n\tGet upto',
                boostDifference,
                '% more boost rewards by making more deposits, borrows or stakes\n'
              );
            }
          }
        }
      }
    }
  });

const perAnnum = (v: BigNumber) => v.mul(365 * DAY);

const formatFixed = (v: BigNumber, decimals: number, precision?: number): number => {
  const p = precision || 4;
  if (decimals <= p) {
    return parseFloat(v.toString()) / 10.0 ** decimals;
  }
  return parseFloat(v.div(powerOf10(decimals - p)).toString()) / 10.0 ** p;
};

const powerOf10 = (n: number) => BigNumber.from(10).pow(n);
