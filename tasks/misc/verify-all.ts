import { task, types } from 'hardhat/config';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { verifyContractStringified } from '../../helpers/etherscan-verification';
import {
  DbInstanceEntry,
  falsyOrZeroAddress,
  getExternalsFromJsonDb,
  getInstancesFromJsonDb,
} from '../../helpers/misc-utils';

task('verify:verify-all-contracts', 'Use JsonDB to perform verification')
  .addOptionalParam('n', 'Batch index, 0 <= n < total number of batches', 0, types.int)
  .addOptionalParam('of', 'Total number of batches, > 0', 1, types.int)
  .addOptionalParam('proxies', 'Selection of proxies: none, first, all, core, ...', 'core', types.string)
  .addOptionalVariadicPositionalParam('filter', 'Names or addresses of contracts to verify', [], types.string)
  .setAction(async ({ n, of, filter, proxies }, DRE: HardhatRuntimeEnvironment) => {
    await DRE.run('set-DRE');

    if (n >= of) {
      throw 'invalid batch parameters';
    }

    let filterProxy: (subType: string) => boolean;
    switch (proxies.toLowerCase()) {
      case '':
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
      if (filterSet.size > 0) {
        let found = false;
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
      } else if (entry.verify?.subType != undefined) {
        if (!filterProxy(entry.verify!.subType!)) {
          return;
        }
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

      const [ok, err] = await verifyContractStringified(addr, params.args!);
      if (err) {
        console.log(err);
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
