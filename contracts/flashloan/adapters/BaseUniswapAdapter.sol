// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.4;

import '../../tools/math/PercentageMath.sol';
import '../../dependencies/openzeppelin/contracts/SafeMath.sol';
import '../../dependencies/openzeppelin/contracts/IERC20.sol';
import '../../dependencies/openzeppelin/contracts/SafeERC20.sol';
import '../../interfaces/IFlashLoanAddressProvider.sol';
import '../../protocol/libraries/types/DataTypes.sol';
import '../../interfaces/IPriceOracleGetter.sol';
import '../../tools/tokens/IERC20WithPermit.sol';
import '../../tools/tokens/IERC20Details.sol';
import '../../tools/SweepBase.sol';
import '../../access/AccessFlags.sol';
import '../../access/AccessHelper.sol';
import '../../misc/interfaces/IWETHGateway.sol';
import '../base/FlashLoanReceiverBase.sol';
import './interfaces/IUniswapV2Router02ForAdapter.sol';
import './interfaces/IBaseUniswapAdapter.sol';

// solhint-disable var-name-mixedcase, func-name-mixedcase
/// @dev Access to Uniswap V2
abstract contract BaseUniswapAdapter is FlashLoanReceiverBase, SweepBase, IBaseUniswapAdapter {
  using SafeMath for uint256;
  using PercentageMath for uint256;
  using SafeERC20 for IERC20;

  // Max slippage percent allowed
  uint256 public immutable override MAX_SLIPPAGE_PERCENT = 3000; // 30%
  // USD oracle asset address
  address public constant override USD_ADDRESS = 0x10F7Fc1F91Ba351f9C629c5947AD69bD03C05b96;

  address public immutable override WETH_ADDRESS;
  IUniswapV2Router02ForAdapter public immutable override UNISWAP_ROUTER;

  constructor(IFlashLoanAddressProvider provider, IUniswapV2Router02ForAdapter uniswapRouter)
    FlashLoanReceiverBase(provider)
  {
    UNISWAP_ROUTER = uniswapRouter;
    IMarketAccessController ac = IMarketAccessController(
      ILendingPool(provider.getLendingPool()).getAddressesProvider()
    );
    WETH_ADDRESS = IWETHGateway(ac.getAddress(AccessFlags.WETH_GATEWAY)).getWETHAddress();
  }

  function ORACLE() public view override returns (IPriceOracleGetter) {
    return IPriceOracleGetter(ADDRESS_PROVIDER.getPriceOracle());
  }

  function getFlashloanPremiumRev() private view returns (uint16) {
    return uint16(SafeMath.sub(PercentageMath.ONE, LENDING_POOL.getFlashloanPremiumPct(), 'INVALID_FLASHLOAN_PREMIUM'));
  }

  function FLASHLOAN_PREMIUM_TOTAL() external view override returns (uint256) {
    return LENDING_POOL.getFlashloanPremiumPct();
  }

  /**
   * @dev Given an input asset amount, returns the maximum output amount of the other asset and the prices
   * @param amountIn Amount of reserveIn
   * @param reserveIn Address of the asset to be swap from
   * @param reserveOut Address of the asset to be swap to
   * @return uint256 Amount out of the reserveOut
   * @return uint256 The price of out amount denominated in the reserveIn currency (18 decimals)
   * @return uint256 In amount of reserveIn value denominated in USD (8 decimals)
   * @return uint256 Out amount of reserveOut value denominated in USD (8 decimals)
   */
  function getAmountsOut(
    uint256 amountIn,
    address reserveIn,
    address reserveOut
  )
    external
    view
    override
    returns (
      uint256,
      uint256,
      uint256,
      uint256,
      address[] memory
    )
  {
    AmountCalc memory results = _getAmountsOutData(reserveIn, reserveOut, amountIn);

    return (results.calculatedAmount, results.relativePrice, results.amountInUsd, results.amountOutUsd, results.path);
  }

  /**
   * @dev Returns the minimum input asset amount required to buy the given output asset amount and the prices
   * @param amountOut Amount of reserveOut
   * @param reserveIn Address of the asset to be swap from
   * @param reserveOut Address of the asset to be swap to
   * @return uint256 Amount in of the reserveIn
   * @return uint256 The price of in amount denominated in the reserveOut currency (18 decimals)
   * @return uint256 In amount of reserveIn value denominated in USD (8 decimals)
   * @return uint256 Out amount of reserveOut value denominated in USD (8 decimals)
   */
  function getAmountsIn(
    uint256 amountOut,
    address reserveIn,
    address reserveOut
  )
    external
    view
    override
    returns (
      uint256,
      uint256,
      uint256,
      uint256,
      address[] memory
    )
  {
    AmountCalc memory results = _getAmountsInData(reserveIn, reserveOut, amountOut);

    return (results.calculatedAmount, results.relativePrice, results.amountInUsd, results.amountOutUsd, results.path);
  }

  /**
   * @dev Swaps an exact `amountToSwap` of an asset to another
   * @param assetToSwapFrom Origin asset
   * @param assetToSwapTo Destination asset
   * @param amountToSwap Exact amount of `assetToSwapFrom` to be swapped
   * @param minAmountOut the min amount of `assetToSwapTo` to be received from the swap
   * @return the amount received from the swap
   */
  function _swapExactTokensForTokens(
    address assetToSwapFrom,
    address assetToSwapTo,
    uint256 amountToSwap,
    uint256 minAmountOut,
    bool useEthPath
  ) internal returns (uint256) {
    uint256 fromAssetDecimals = _getDecimals(assetToSwapFrom);
    uint256 toAssetDecimals = _getDecimals(assetToSwapTo);

    IPriceOracleGetter oracle = ORACLE();

    uint256 fromAssetPrice = oracle.getAssetPrice(assetToSwapFrom);
    uint256 toAssetPrice = oracle.getAssetPrice(assetToSwapTo);

    uint256 expectedMinAmountOut = amountToSwap
      .mul(fromAssetPrice.mul(10**toAssetDecimals))
      .div(toAssetPrice.mul(10**fromAssetDecimals))
      .percentMul(PercentageMath.PERCENTAGE_FACTOR.sub(MAX_SLIPPAGE_PERCENT));

    require(expectedMinAmountOut < minAmountOut, 'minAmountOut exceed max slippage');

    // Approves the transfer for the swap. Approves for 0 first to comply with tokens that implement the anti frontrunning approval fix.
    IERC20(assetToSwapFrom).safeApprove(address(UNISWAP_ROUTER), 0);
    IERC20(assetToSwapFrom).safeApprove(address(UNISWAP_ROUTER), amountToSwap);

    address[] memory path;
    if (useEthPath) {
      path = new address[](3);
      path[0] = assetToSwapFrom;
      path[1] = WETH_ADDRESS;
      path[2] = assetToSwapTo;
    } else {
      path = new address[](2);
      path[0] = assetToSwapFrom;
      path[1] = assetToSwapTo;
    }
    uint256[] memory amounts = UNISWAP_ROUTER.swapExactTokensForTokens(
      amountToSwap,
      minAmountOut,
      path,
      address(this),
      block.timestamp
    );

    emit Swapped(assetToSwapFrom, assetToSwapTo, amounts[0], amounts[amounts.length - 1]);

    return amounts[amounts.length - 1];
  }

  /**
   * @dev Receive an exact amount `amountToReceive` of `assetToSwapTo` tokens for as few `assetToSwapFrom` tokens as
   * possible.
   * @param assetToSwapFrom Origin asset
   * @param assetToSwapTo Destination asset
   * @param maxAmountToSwap Max amount of `assetToSwapFrom` allowed to be swapped
   * @param amountToReceive Exact amount of `assetToSwapTo` to receive
   * @return the amount swapped
   */
  function _swapTokensForExactTokens(
    address assetToSwapFrom,
    address assetToSwapTo,
    uint256 maxAmountToSwap,
    uint256 amountToReceive,
    bool useEthPath
  ) internal returns (uint256) {
    uint256 fromAssetDecimals = _getDecimals(assetToSwapFrom);
    uint256 toAssetDecimals = _getDecimals(assetToSwapTo);

    IPriceOracleGetter oracle = ORACLE();

    uint256 fromAssetPrice = oracle.getAssetPrice(assetToSwapFrom);
    uint256 toAssetPrice = oracle.getAssetPrice(assetToSwapTo);

    uint256 expectedMaxAmountToSwap = amountToReceive
      .mul(toAssetPrice.mul(10**fromAssetDecimals))
      .div(fromAssetPrice.mul(10**toAssetDecimals))
      .percentMul(PercentageMath.PERCENTAGE_FACTOR.add(MAX_SLIPPAGE_PERCENT));

    require(maxAmountToSwap < expectedMaxAmountToSwap, 'maxAmountToSwap exceed max slippage');

    // Approves the transfer for the swap. Approves for 0 first to comply with tokens that implement the anti frontrunning approval fix.
    IERC20(assetToSwapFrom).safeApprove(address(UNISWAP_ROUTER), 0);
    IERC20(assetToSwapFrom).safeApprove(address(UNISWAP_ROUTER), maxAmountToSwap);

    address[] memory path;
    if (useEthPath) {
      path = new address[](3);
      path[0] = assetToSwapFrom;
      path[1] = WETH_ADDRESS;
      path[2] = assetToSwapTo;
    } else {
      path = new address[](2);
      path[0] = assetToSwapFrom;
      path[1] = assetToSwapTo;
    }

    uint256[] memory amounts = UNISWAP_ROUTER.swapTokensForExactTokens(
      amountToReceive,
      maxAmountToSwap,
      path,
      address(this),
      block.timestamp
    );

    emit Swapped(assetToSwapFrom, assetToSwapTo, amounts[0], amounts[amounts.length - 1]);

    return amounts[0];
  }

  /**
   * @dev Get the decimals of an asset
   * @return number of decimals of the asset
   */
  function _getDecimals(address asset) internal view returns (uint256) {
    return IERC20Details(asset).decimals();
  }

  /**
   * @dev Get the depositToken associated to the asset
   * @return address of the depositToken
   */
  function _getReserveData(address asset) internal view returns (DataTypes.ReserveData memory) {
    return LENDING_POOL.getReserveData(asset);
  }

  /**
   * @dev Pull the deposit tokens from the user
   * @param reserve address of the asset
   * @param depositToken address of the depositToken of the reserve
   * @param user address
   * @param amount of tokens to be transferred to the contract
   * @param permitSignature struct containing the permit signature
   */
  function _pullDepositToken(
    address reserve,
    address depositToken,
    address user,
    uint256 amount,
    PermitSignature memory permitSignature
  ) internal {
    if (_usePermit(permitSignature)) {
      IERC20WithPermit(depositToken).permit(
        user,
        address(this),
        permitSignature.amount,
        permitSignature.deadline,
        permitSignature.v,
        permitSignature.r,
        permitSignature.s
      );
    }

    // transfer from user to adapter
    IERC20(depositToken).safeTransferFrom(user, address(this), amount);

    // withdraw reserve
    LENDING_POOL.withdraw(reserve, amount, address(this));
  }

  /**
   * @dev Tells if the permit method should be called by inspecting if there is a valid signature.
   * If signature params are set to 0, then permit won't be called.
   * @param signature struct containing the permit signature
   * @return whether or not permit should be called
   */
  function _usePermit(PermitSignature memory signature) internal pure returns (bool) {
    return !(uint256(signature.deadline) == uint256(signature.v) && uint256(signature.deadline) == 0);
  }

  struct AssetUsdPrice {
    uint256 ethUsdPrice;
    uint256 reservePrice;
    uint256 decimals;
  }

  /**
   * @dev Calculates the value denominated in USD
   * @param reserve Reserve price params
   * @param amount Amount of the reserve
   * @return whether or not permit should be called
   */
  function _calcUsdValue(AssetUsdPrice memory reserve, uint256 amount) internal pure returns (uint256) {
    return amount.mul(reserve.reservePrice).div(10**reserve.decimals).mul(reserve.ethUsdPrice).div(10**18);
  }

  /**
   * @dev Given an input asset amount, returns the maximum output amount of the other asset
   * @param reserveIn Address of the asset to be swap from
   * @param reserveOut Address of the asset to be swap to
   * @param amountIn Amount of reserveIn
   * @return Struct containing the following information:
   *   uint256 Amount out of the reserveOut
   *   uint256 The price of out amount denominated in the reserveIn currency (18 decimals)
   *   uint256 In amount of reserveIn value denominated in USD (8 decimals)
   *   uint256 Out amount of reserveOut value denominated in USD (8 decimals)
   */
  function _getAmountsOutData(
    address reserveIn,
    address reserveOut,
    uint256 amountIn
  ) internal view returns (AmountCalc memory) {
    // Deduct flash loan fee
    uint256 finalAmountIn = amountIn.percentMul(getFlashloanPremiumRev());

    IPriceOracleGetter oracle = ORACLE();

    AssetUsdPrice memory reserveInPrice = AssetUsdPrice(
      oracle.getAssetPrice(USD_ADDRESS),
      oracle.getAssetPrice(reserveIn),
      _getDecimals(reserveIn)
    );
    AssetUsdPrice memory reserveOutPrice;

    if (reserveIn == reserveOut) {
      reserveOutPrice = reserveInPrice;
      address[] memory path = new address[](1);
      path[0] = reserveIn;

      return
        AmountCalc(
          finalAmountIn,
          finalAmountIn.mul(10**18).div(amountIn),
          _calcUsdValue(reserveInPrice, amountIn),
          _calcUsdValue(reserveInPrice, finalAmountIn),
          path
        );
    } else {
      reserveOutPrice = AssetUsdPrice(
        reserveInPrice.ethUsdPrice,
        oracle.getAssetPrice(reserveOut),
        _getDecimals(reserveOut)
      );
    }

    address[] memory simplePath = new address[](2);
    simplePath[0] = reserveIn;
    simplePath[1] = reserveOut;

    uint256[] memory amountsWithoutWeth;
    uint256[] memory amountsWithWeth;

    address[] memory pathWithWeth = new address[](3);
    if (reserveIn != WETH_ADDRESS && reserveOut != WETH_ADDRESS) {
      pathWithWeth[0] = reserveIn;
      pathWithWeth[1] = WETH_ADDRESS;
      pathWithWeth[2] = reserveOut;

      try UNISWAP_ROUTER.getAmountsOut(finalAmountIn, pathWithWeth) returns (uint256[] memory resultsWithWeth) {
        amountsWithWeth = resultsWithWeth;
      } catch {
        amountsWithWeth = new uint256[](3);
      }
    } else {
      amountsWithWeth = new uint256[](3);
    }

    uint256 bestAmountOut;
    try UNISWAP_ROUTER.getAmountsOut(finalAmountIn, simplePath) returns (uint256[] memory resultAmounts) {
      amountsWithoutWeth = resultAmounts;

      bestAmountOut = (amountsWithWeth[2] > amountsWithoutWeth[1]) ? amountsWithWeth[2] : amountsWithoutWeth[1];
    } catch {
      amountsWithoutWeth = new uint256[](2);
      bestAmountOut = amountsWithWeth[2];
    }

    uint256 outPerInPrice = finalAmountIn.mul(10**18).mul(10**reserveOutPrice.decimals).div(
      bestAmountOut.mul(10**reserveInPrice.decimals)
    );

    return
      AmountCalc(
        bestAmountOut,
        outPerInPrice,
        _calcUsdValue(reserveInPrice, amountIn),
        _calcUsdValue(reserveOutPrice, bestAmountOut),
        (bestAmountOut == 0) ? new address[](2) : (bestAmountOut == amountsWithoutWeth[1]) ? simplePath : pathWithWeth
      );
  }

  /**
   * @dev Returns the minimum input asset amount required to buy the given output asset amount
   * @param reserveIn Address of the asset to be swap from
   * @param reserveOut Address of the asset to be swap to
   * @param amountOut Amount of reserveOut
   * @return Struct containing the following information:
   *   uint256 Amount in of the reserveIn
   *   uint256 The price of in amount denominated in the reserveOut currency (18 decimals)
   *   uint256 In amount of reserveIn value denominated in USD (8 decimals)
   *   uint256 Out amount of reserveOut value denominated in USD (8 decimals)
   */
  function _getAmountsInData(
    address reserveIn,
    address reserveOut,
    uint256 amountOut
  ) internal view returns (AmountCalc memory) {
    IPriceOracleGetter oracle = ORACLE();

    AssetUsdPrice memory reserveInPrice = AssetUsdPrice(
      oracle.getAssetPrice(USD_ADDRESS),
      oracle.getAssetPrice(reserveIn),
      _getDecimals(reserveIn)
    );
    AssetUsdPrice memory reserveOutPrice;

    uint16 flashloanPremiumRev = getFlashloanPremiumRev();

    if (reserveIn == reserveOut) {
      reserveOutPrice = reserveInPrice;
      // Add flash loan fee
      uint256 amountIn = amountOut.percentDiv(flashloanPremiumRev);
      address[] memory path_ = new address[](1);
      path_[0] = reserveIn;

      return
        AmountCalc(
          amountIn,
          amountOut.mul(10**18).div(amountIn),
          _calcUsdValue(reserveInPrice, amountIn),
          _calcUsdValue(reserveInPrice, amountOut),
          path_
        );
    } else {
      reserveOutPrice = AssetUsdPrice(
        reserveInPrice.ethUsdPrice,
        oracle.getAssetPrice(reserveOut),
        _getDecimals(reserveOut)
      );
    }

    (uint256[] memory amounts, address[] memory path) = _getAmountsInAndPath(reserveIn, reserveOut, amountOut);

    // Add flash loan fee
    uint256 finalAmountIn = amounts[0].percentDiv(flashloanPremiumRev);

    uint256 inPerOutPrice = amountOut.mul(10**18).mul(10**reserveInPrice.decimals).div(
      finalAmountIn.mul(10**reserveOutPrice.decimals)
    );

    return
      AmountCalc(
        finalAmountIn,
        inPerOutPrice,
        _calcUsdValue(reserveInPrice, finalAmountIn),
        _calcUsdValue(reserveOutPrice, amountOut),
        path
      );
  }

  /**
   * @dev Calculates the input asset amount required to buy the given output asset amount
   * @param reserveIn Address of the asset to be swap from
   * @param reserveOut Address of the asset to be swap to
   * @param amountOut Amount of reserveOut
   * @return uint256[] amounts Array containing the amountIn and amountOut for a swap
   */
  function _getAmountsInAndPath(
    address reserveIn,
    address reserveOut,
    uint256 amountOut
  ) internal view returns (uint256[] memory, address[] memory) {
    address[] memory simplePath = new address[](2);
    simplePath[0] = reserveIn;
    simplePath[1] = reserveOut;

    uint256[] memory amountsWithoutWeth;
    uint256[] memory amountsWithWeth;
    address[] memory pathWithWeth = new address[](3);

    if (reserveIn != WETH_ADDRESS && reserveOut != WETH_ADDRESS) {
      pathWithWeth[0] = reserveIn;
      pathWithWeth[1] = WETH_ADDRESS;
      pathWithWeth[2] = reserveOut;

      try UNISWAP_ROUTER.getAmountsIn(amountOut, pathWithWeth) returns (uint256[] memory resultsWithWeth) {
        amountsWithWeth = resultsWithWeth;
      } catch {
        amountsWithWeth = new uint256[](3);
      }
    } else {
      amountsWithWeth = new uint256[](3);
    }

    try UNISWAP_ROUTER.getAmountsIn(amountOut, simplePath) returns (uint256[] memory resultAmounts) {
      amountsWithoutWeth = resultAmounts;

      return
        (amountsWithWeth[0] < amountsWithoutWeth[0] && amountsWithWeth[0] != 0)
          ? (amountsWithWeth, pathWithWeth)
          : (amountsWithoutWeth, simplePath);
    } catch {
      return (amountsWithWeth, pathWithWeth);
    }
  }

  /**
   * @dev Calculates the input asset amount required to buy the given output asset amount
   * @param reserveIn Address of the asset to be swap from
   * @param reserveOut Address of the asset to be swap to
   * @param amountOut Amount of reserveOut
   * @return uint256[] amounts Array containing the amountIn and amountOut for a swap
   */
  function _getAmountsIn(
    address reserveIn,
    address reserveOut,
    uint256 amountOut,
    bool useEthPath
  ) internal view returns (uint256[] memory) {
    address[] memory path;

    if (useEthPath) {
      path = new address[](3);
      path[0] = reserveIn;
      path[1] = WETH_ADDRESS;
      path[2] = reserveOut;
    } else {
      path = new address[](2);
      path[0] = reserveIn;
      path[1] = reserveOut;
    }

    return UNISWAP_ROUTER.getAmountsIn(amountOut, path);
  }

  function _onlySweepAdmin() internal view override {
    IMarketAccessController ac = IMarketAccessController(LENDING_POOL.getAddressesProvider());
    AccessHelper.requireAnyOf(ac, msg.sender, AccessFlags.SWEEP_ADMIN, Errors.CALLER_NOT_SWEEP_ADMIN);
  }
}
