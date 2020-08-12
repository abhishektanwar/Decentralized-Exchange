const Dai = artifacts.require("./Dai.sol");
const Bat = artifacts.require("./Bat.sol");
const Rep = artifacts.require("./Rep.sol");
const Zrx = artifacts.require("./Zrx.sol");
const Dex = artifacts.require("./Dex.sol");

//bytes32 conversion for ticker argument
const [DAI, BAT, REP, ZRX] = ['DAI', 'BAT', 'REP', 'ZRX']
    .map(token => web3.utils.fromAscii(token));

const SIDE = {
    BUY:0,
    SELL:1
};

module.exports =async function (deployer, _network, accounts) {
    //deploy all contracts
    await Promise.all(
        [Dai, Bat, Rep, Zrx, Dex].map(contract => deployer.deploy(contract))
    );
    // instance of deployed contracts
    const [dai, bat, rep, zrx, dex] = await Promise.all(
        [Dai, Bat, Rep, Zrx, Dex].map(contract => contract.deployed())
    );

    await Promise.all([
        dex.addToken(DAI,dai.address),
        dex.addToken(BAT,bat.address),
        dex.addToken(REP,rep.address),
        dex.addToken(ZRX,zrx.address)
    ]);

    const [trader1, trader2, trader3, trader4, _] = accounts;
    // token is instance of DAI/BAT/REP/ZRX
    // token.faucet mints amount number of tokens in trader's wallet
    // trader sends a txn to each token wallet to approve dex to withdraw amount number of tokens

    const amount = web3.utils.toWei('1000000');
    const seedTokenBalance = async (token,trader) => {
        await token.faucet(trader,amount);
        await token.approve(
            dex.address,
            amount,
            {from:trader}
        );
        const ticker = await token.name();

        await dex.deposit(
            amount,
            web3.utils.fromAscii(ticker),
            {from:trader}
        );
    };
    
    await Promise.all(
        [dai,bat,rep,zrx].map(token => seedTokenBalance(token,trader1))
    );
    await Promise.all(
        [dai,bat,rep,zrx].map(token => seedTokenBalance(token,trader2))
    );
    await Promise.all(
        [dai,bat,rep,zrx].map(token => seedTokenBalance(token,trader3))
    );
    await Promise.all(
        [dai,bat,rep,zrx].map(token => seedTokenBalance(token,trader4))
    );    
    
    // function to increase the time of dummy blockchain when orders are placed manually

    const increaseTime =async (seconds) => {
        await web3.currentProvider.send({
            jsonrpc:'2.0',
            method:'evm_increaseTime',
            params: [seconds],
            id:0,
        },() => {});
        await web3.currentProvider.send({
            jsonrpc:'2.0',
            method:'evm_mine',
            params:[],
            id:0,
        }, () => {});
    };

    // create fake orders 
    // createLimitOrder => ticker,amount,price,side
    //createMarketOrder => ticker,amount,side
    await dex.createLimitOrder(BAT, 1000, 10, SIDE.BUY, {from: trader1});
    await dex.createMarketOrder(BAT, 1000, SIDE.SELL, {from:trader2});
    increaseTime(1);
    await dex.createLimitOrder(BAT, 1200, 11, SIDE.BUY, {from: trader1});
    await dex.createMarketOrder(BAT, 1200, SIDE.SELL, {from:trader2});
    increaseTime(1);
    await dex.createLimitOrder(BAT, 1200, 15, SIDE.BUY, {from: trader1});
    await dex.createMarketOrder(BAT, 1200, SIDE.SELL, {from:trader2});
    increaseTime(1);
    await dex.createLimitOrder(BAT, 1500, 14, SIDE.BUY, {from: trader1});
    await dex.createMarketOrder(BAT, 1500, SIDE.SELL, {from:trader2});
    increaseTime(1);
    await dex.createLimitOrder(BAT, 2000, 12, SIDE.BUY, {from: trader1});
    await dex.createMarketOrder(BAT, 2000, SIDE.SELL, {from:trader2});
    increaseTime(1);

    await dex.createLimitOrder(REP, 1000, 2, SIDE.BUY, {from: trader1});
    await dex.createMarketOrder(REP, 1000, SIDE.SELL, {from:trader2});
    increaseTime(1);
    await dex.createLimitOrder(REP, 500, 4, SIDE.BUY, {from: trader1});
    await dex.createMarketOrder(REP, 500, SIDE.SELL, {from:trader2});
    increaseTime(1);
    await dex.createLimitOrder(REP, 800, 2, SIDE.BUY, {from: trader1});
    await dex.createMarketOrder(REP, 800, SIDE.SELL, {from:trader2});
    increaseTime(1);
    await dex.createLimitOrder(REP, 1200, 6, SIDE.BUY, {from: trader1});
    await dex.createMarketOrder(REP, 1200, SIDE.SELL, {from:trader2});
    increaseTime(1);

    // create trades
    await Promise.all([
        dex.createLimitOrder(BAT, 1400, 10, SIDE.BUY, {from:trader1}),
        dex.createLimitOrder(BAT, 1200, 11, SIDE.BUY, {from:trader2}),
        dex.createLimitOrder(BAT, 1000, 12, SIDE.BUY, {from:trader2}),

        dex.createLimitOrder(REP, 3000, 4, SIDE.BUY, {from:trader1}),
        dex.createLimitOrder(REP, 2000, 5, SIDE.BUY, {from:trader1}),
        dex.createLimitOrder(REP, 500, 6, SIDE.BUY, {from:trader2}),

        dex.createLimitOrder(ZRX, 4000, 12, SIDE.BUY, {from:trader1}),
        dex.createLimitOrder(ZRX, 3000, 13, SIDE.BUY, {from:trader1}),
        dex.createLimitOrder(ZRX, 500, 14, SIDE.BUY, {from:trader2}),

        dex.createLimitOrder(BAT, 2000, 16, SIDE.SELL, {from:trader3}),
        dex.createLimitOrder(BAT, 3000, 15, SIDE.SELL, {from:trader4}),
        dex.createLimitOrder(BAT, 500, 14, SIDE.SELL, {from:trader4}),

        dex.createLimitOrder(REP, 4000, 10, SIDE.SELL, {from:trader3}),
        dex.createLimitOrder(REP, 2000, 9, SIDE.SELL, {from:trader3}),
        dex.createLimitOrder(REP, 800, 8, SIDE.SELL, {from:trader4}),

        dex.createLimitOrder(ZRX, 1500, 23, SIDE.SELL, {from:trader3}),
        dex.createLimitOrder(ZRX, 1200, 22, SIDE.SELL, {from:trader3}),
        dex.createLimitOrder(ZRX, 900, 21, SIDE.SELL, {from:trader4}),

    ]);
    let buyOrders = await dex.getOrders(BAT,SIDE.BUY);
    console.log(buyOrders);
    let sellOrders = await dex.getOrders(BAT,SIDE.SELL);
    console.log(sellOrders);
    
};
// 1000000000000000000000
