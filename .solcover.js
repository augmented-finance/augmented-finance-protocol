const accounts = require(`./test-wallets.js`).accounts;

module.exports = {
  client: require('ganache-cli'),
  skipFiles: [
    './mocks',
    './interfaces',
    './protocol',
    './misc',
    './adapters',
    './flashloan'
  ],
  mocha: {
    enableTimeouts: false,
  },
  providerOptions: {
    accounts,
  },
};

