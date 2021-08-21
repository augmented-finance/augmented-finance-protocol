import { task, types } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { verifyContractStringified, verifyProxy } from '../../helpers/etherscan-verification';
import {
  DbInstanceEntry,
  falsyOrZeroAddress,
  getExternalsFromJsonDb,
  getInstancesFromJsonDb,
} from '../../helpers/misc-utils';

task('verify:verify-all-contracts', 'Use JsonDB to perform verification')
  .addOptionalParam('n', 'Batch index, 0 <= n < total number of batches', 0, types.int)
  .addOptionalParam('of', 'Total number of batches, > 0', 1, types.int)
  .addOptionalParam('select', 'Selection of : any, contracts, proxies', 'any', types.string)
  .addOptionalParam('proxies', 'Selection of proxies: none, first, all, core, ...', '', types.string)
  .addOptionalVariadicPositionalParam('filter', 'Names or addresses of contracts to verify', [], types.string)
  .setAction(async ({ n, of, filter, proxies, select }, DRE: HardhatRuntimeEnvironment) => {
    await DRE.run('set-DRE');

    if (n >= of) {
      throw 'invalid batch parameters';
    }

    let ignoreContracts = false;
    switch (select.toLowerCase()) {
      case 'contracts':
        proxies = 'none';
        break;
      case 'proxies':
        if (proxies == '') {
          proxies = 'all';
        }
        ignoreContracts = true;
        break;
    }

    let filterProxy: (subType: string) => boolean;
    switch (proxies.toLowerCase()) {
      case 'none':
        filterProxy = (subType: string) => false;
        break;
      case 'first':
        let hasFirst = false;
        filterProxy = (subType: string) => {
          if (hasFirst) {
            return false;
          }
          hasFirst = true;
          return true;
        };
        break;
      case '*':
      case 'all':
        filterProxy = (subType: string) => true;
        break;
      case '':
        proxies = 'core';
      default:
        filterProxy = (subType: string) => subType == proxies;
        break;
    }

    const filterSet = new Map<string, string>();
    (<string[]>filter).forEach((value) => {
      filterSet.set(value.toUpperCase(), value);
    });

    const addrList: string[] = [];
    const entryList: DbInstanceEntry[] = [];
    let batchIndex = 0;

    const addEntry = (addr: string, entry: DbInstanceEntry) => {
      if (!entry.verify) {
        return;
      }

      let found = false;
      if (filterSet.size > 0) {
        for (const key of [addr, entry.id]) {
          const kv = key.toUpperCase();
          if (filterSet.has(kv)) {
            found = true;
            if (key == addr) {
              filterSet.delete(kv);
            }
            break;
          }
        }
        if (!found) {
          return;
        }
        // explicit filter takes precedence
      } else if (entry.verify.impl) {
        if (!filterProxy(entry.verify.subType || 'core')) {
          return;
        }
      }
      if (!found && ignoreContracts && !entry.verify.impl) {
        return;
      }

      if (batchIndex++ % of != n) {
        return;
      }
      addrList.push(addr);
      entryList.push(entry);
    };

    for (const [key, entry] of getInstancesFromJsonDb()) {
      addEntry(key, entry);
    }

    for (const [key, entry] of getExternalsFromJsonDb()) {
      addEntry(key, entry);
    }

    for (const [key, value] of filterSet) {
      if (!falsyOrZeroAddress(value)) {
        addEntry(value, {
          id: 'ID_' + key,
          verify: {
            args: '[]',
          },
        });
      }
    }

    console.log('======================================================================');
    console.log('======================================================================');
    console.log(`Verification batch ${n} of ${of} with ${addrList.length} entries of ${batchIndex} total.`);
    console.log('======================================================================');

    const summary: string[] = [];
    for (let i = 0; i < addrList.length; i++) {
      const addr = addrList[i];
      const entry = entryList[i];

      const params = entry.verify!;

      console.log('\n======================================================================');
      console.log(`[${i}/${addrList.length}] Verify contract: ${entry.id} ${addr}`);
      console.log('\tArgs:', params.args);

      if (params.impl) {
        console.log('\tProxy impl: ', params.impl);
      }

      let [ok, err] = [true, '']; // await verifyContractStringified(addr, params.args!);
      if (err) {
        console.log(err);
      }
      if (ok && params.impl) {
        [ok, err] = await verifyProxy(addr, params.impl!);
        if (err) {
          console.log(err);
        }
      }
      if (!ok) {
        summary.push(`${addr} ${entry.id}: ${err}`);
      }
    }

    console.log(`\n`);
    console.log('======================================================================');
    console.log(`Verification batch ${n} of ${of} has finished with ${summary.length} issue(s).`);
    console.log('======================================================================');
    console.log(summary.join('\n'));
    console.log('======================================================================');
  });
