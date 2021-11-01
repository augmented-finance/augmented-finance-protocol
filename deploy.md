# Deploy instruction

Deploy consists of two steps: contracts deployment and contracts verification on etherscan.

Make sure you complete all these steps and you'll successfully deploy and verify all the contracts.

1. Make you have `.env` file with `INFURA_KEY` and `ETHERSCAN_KEY`.
2. Make sure your deployer address has enough ETH to deploy contracts. Full deploy requires 120-150M of gas.
3. `npm run deploy:{network} -- --verify` (network is one of `kovan`, `main`)

# Notes

1. You can use `--incremental` for incremental deploy.

    Example:    
    ```
    npm run deploy:kovan -- --verify --incremental
    ```
2. `--verify` is optional key. It's possible to separate deploy from verification.

    Example:
    ```
    npm run verify:kovan
    ```
