# Deploy instruction

Deploy consists of two steps: contracts deployment and contracts verification on etherscan.

Make sure you complete all these steps and you'll successfully deploy and verify all the contracts.

1. Make you have `.env` file with `INFURA_KEY`, `MNEMONIC` and `ETHERSCAN_KEY`.
2. Make sure your deployer address has enough ETH to deploy contracts. Full deploy requires 120-150M of gas.
3. `npm run deploy:{network}` where `network` is one of `rinkeby`, `ropsten`, `kovan`, `main`, and `fork` (fork of the mainnet).
4. `npm run verify:{network}` to verify contracts after the last deploy.

# Notes

1. When the deploy was interrupted, you can use `--incremental` key to continue the last deploy.

    Example:    
    ```
    npm run deploy:kovan -- --incremental
    ```
2. The key `--verify` can be specified for deloy call to perform verification after a successful deploy.

    Example:
    ```
    npm run deploy:kovan -- --verify
    ```

3. Verify stores a list of verified contracts and can be executed incrementally / multiple times without re-verification.
