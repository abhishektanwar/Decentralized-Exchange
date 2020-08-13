import React,{useState,useEffect} from 'react';
import Header from './Header.js';
import WalletComponent from './WalletComponent.js';
import NewOrder from './NewOrder.js';
import AllOrder from './AllOrder.js';
import MyOrders from './MyOrders.js';
const SIDE = {
  BUY:0,
  SELL:1
};



function App({web3, accounts, contracts}) {
  const [tokens,setTokens] = useState([]);
  const [user,setUser] = useState({
    accounts:[],
    balances:{
      tokenDex:0,
      tokenWallet:0
    },
    selectedToken:undefined
  });
  const [orders, setOrders] = useState({
    buy:[],
    sell:[]
  });
  const selectToken = token => {
    setUser({...user, selectedToken:token});
  }

  const getBalances = async (account, token) => {
    const tokenDex = await contracts.dex.methods
      .traderBalances(account, web3.utils.fromAscii(token.ticker))
      .call();
    const tokenWallet = await contracts[token.ticker].methods
      .balanceOf(account).call();
    return {tokenDex, tokenWallet};
  }

  const getOrders = async (token) => {
    const buyorders = await contracts.dex.methods 
      .getOrders(web3.utils.fromAscii(token.ticker),SIDE.BUY)
      .call();
    const sellorders = await contracts.dex.methods
      .getOrders(web3.utils.fromAscii(token.ticker),SIDE.SELL)
      .call();
    
    return {buy:buyorders,sell:sellorders};
  }

  const deposit =async (amount) => {
    await contracts[user.selectedToken.ticker].methods
    .approve(contracts.dex.options.address, amount)
    .send({from:accounts[0]});
    await contracts.dex.methods
    .deposit(
      amount,
      web3.utils.fromAscii(user.selectedToken.ticker)
    )
    .send({from:user.accounts[0]});

    const balances = await getBalances(
      user.accounts[0],
      user.selectedToken
    );
    setUser(user => ({...user, balances}));
  }

  const withdraw =async (amount) => {
    await contracts.dex.methods
    .withdraw(
      amount,
      web3.utils.fromAscii(user.selectedToken.ticker)
    )
    .send({from:user.accounts[0]});

    const balances = await getBalances(
      user.accounts[0],
      user.selectedToken
    );
    setUser(user => ({...user, balances}));
  }
  const createMarketOrder =async (amount, side) => {
    await contracts.dex.methods.
      createMarketOrder(
        web3.utils.fromAscii(user.selectedToken.ticker),
        amount,
        side
      )
      .send({from:user.accounts[0]});
      const orders = await getOrders(user.selectedToken);
      setOrders(orders);
  };

  const createLimitOrder =async (amount, price, side) => {
    await contracts.dex.methods
      .createLimitOrder(
        web3.utils.fromAscii(user.selectedToken.ticker),
        amount,
        price,
        side
      )
      .send({from:user.accounts[0]});
      const orders = await getOrders(user.selectedToken);
      setOrders(orders);
    };

  useEffect(() => {
    const init = async () => {
      const rawTokens = await contracts.dex.methods.getTokens().call();
      const tokens = rawTokens.map(token=> ({
        ...token,
        ticker:web3.utils.hexToUtf8(token.ticker)
      }));
      const balances = await getBalances(accounts[0], tokens[0]);
      const orders = await getOrders(tokens[0]);
      setTokens(tokens);
      setUser({accounts, balances, selectedToken:tokens[0]});
      setOrders(orders);

    }
    init();
    
  }, []);

  useEffect(() => {
    const init = async () => {
      const balances = await getBalances(accounts[0], user.selectedToken);
      const orders = await getOrders(user.selectedToken);
      setUser({...user,balances});
      setOrders(orders);
    }
    if(typeof user.selectedToken !== 'undefined'){
      init();
    }
  },[user.selectedToken]);

  if(typeof user.selectedToken === 'undefined'){
    return(<div>LOADING...</div>)
  }
  return (
    <div id="app">
      <Header 
        contracts={contracts}
        tokens = {tokens}
        user = {user}
        selectToken = {selectToken}
      />
      <main className="container-fluid">
        <div className="row">
          <div className="col-sm-4 first-col">
            <WalletComponent
              user={user}
              deposit={deposit}
              withdraw={withdraw}
            />
            {user.selectedToken.ticker!=='DAI' ? (
              <NewOrder 
                createMarketOrder={createMarketOrder}  
                createLimitOrder={createLimitOrder} 
              />
            ):null}
          </div>
          {
            user.selectedToken !=='DAI' ? (
              <div className="col-sm-8">
                <AllOrder 
                  orders={orders}
                />
                <MyOrders 
                  orders = {{
                    // sending only buy / sell orders of current user through filtering
                    buy: orders.buy.filter(
                      order => order.trader.toLowerCase() === user.accounts[0].toLowerCase()
                    ),
                    sell: orders.sell.filter(
                      order => order.trader.toLowerCase() === user.accounts[0].toLowerCase()
                    )
                  }}
                />
              </div>
            ) : null
          }
        </div>
      </main>
    </div>
  );
}

export default App;
