pragma solidity 0.6.3;
pragma experimental ABIEncoderV2;
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';
contract Dex {
    
    using SafeMath for uint;
    
    //type of order buy or sell
    enum Side{
        BUY,
        SELL
    }
    
    struct Token{
        bytes32 ticker;
        address tokenAddress;
    }
    //details of each order
    struct Order {
        uint id;
        address trader;
        Side side;
        bytes32 ticker;
        uint amount;
        uint filled;
        uint price;
        uint date;
    }
    
    bytes32 constant DAI = bytes32('DAI');
    
    //array or order structure(ticker => uint(buy,0/sell,1) => all orders)
    //all orders(decreasing order) of x token of buy type
    mapping(bytes32 => mapping(uint => Order[])) public orderBook;
    
    mapping(bytes32 => Token) public tokens;
    mapping(address => mapping(bytes32=>uint)) public traderBalances;
    bytes32[] public tokenList;
    
    address public admin;
    
    //tracker for next order ID
    uint public nextOrderId;
    
    uint public nextTradeId;
    //for market trades
    event newTrade(
        uint tradeId,
        uint orderId,
        bytes32 indexed ticker,
        address indexed trader1,
        address indexed trader2,
        uint amount,
        uint price,
        uint date
    );
    
    constructor() public {
        admin= msg.sender;
    }

    function getOrders(
        bytes32 ticker,
        Side side)
        external
        view
        returns(Order[] memory){
            return orderBook[ticker][uint(side)];
        }

    function getTokens()
        external
        view
        returns(Token[] memory){
            Token[] memory _tokens = new Token[](tokenList.length);
            for(uint i=0;i < tokenList.length ;i++){
                _tokens[i] = Token(
                    tokens[tokenList[i]].ticker,
                    tokens[tokenList[i]].tokenAddress
                );
            }
            return _tokens;
        }

    function addToken(
        bytes32 ticker,
        address  tokenAddress)
        onlyAdmin()
        external{
            tokens[ticker] = Token(ticker, tokenAddress);
            tokenList.push(ticker);
        }
        
    modifier onlyAdmin(){
        require(msg.sender == admin, "only admin can access");
        _;
    }
    
    function deposit(
        uint amount,
        bytes32 ticker)
        tokenExist(ticker) 
        external {
        IERC20(tokens[ticker].tokenAddress).transferFrom(
                msg.sender,
                address(this),
                amount
        );
        traderBalances[msg.sender][ticker] = traderBalances[msg.sender][ticker].add(amount);    
    }
    
    function withdraw(
        uint amount,
        bytes32 ticker)
        tokenExist(ticker) 
        external {
        require(
            traderBalances[msg.sender][ticker] >= amount,
            'insufficient tokens'
        );
        traderBalances[msg.sender][ticker] = traderBalances[msg.sender][ticker].sub(amount);
        IERC20(tokens[ticker].tokenAddress).transfer(msg.sender, amount);
    }
    
    function createLimitOrder(
        bytes32 ticker, 
        uint amount,
        uint price, 
        Side side) 
        tokenExist(ticker) 
        tokenIsNotDai(ticker)
        external {
        //DAI is quote currency, all erc20 tokens are sold/purchased agains DAI coin
        // require(ticker != DAI,'cannot trade DAI');
        if(side == Side.SELL){
            require(
                traderBalances[msg.sender][ticker] >= amount,
                'token balance too low'
            );
        }else {
            require(
                traderBalances[msg.sender][DAI] >= amount.mul(price),
                'dai balance too low'
            );
        }
        
        Order[] storage orders = orderBook[ticker][uint(side)];
        orders.push(Order(
            nextOrderId,
            msg.sender,
            side,
            ticker,
            amount,
            0,
            price,
            now
        ));
        
        //bubble sort to arrange orders on basis or price
        uint i = orders.length > 0 ? orders.length - 1 : 0 ;
        while(i>0){
            if(side == Side.BUY && orders[i-1].price>orders[i].price){
                break;
            }
            if(side == Side.SELL && orders[i-1].price<orders[i].price){
                break;
            }
            
            Order memory order = orders[i-1];
            orders[i-1] = orders[i];
            orders[i] = order;
            i= i.sub(1);
        }
        nextOrderId = nextOrderId.add(1);
    }
    
    function createMarketOrder(
        bytes32 ticker,
        uint amount,
        Side side)
        tokenExist(ticker)
        tokenIsNotDai(ticker)
    external{
        if(side == Side.SELL){
            require(
                traderBalances[msg.sender][ticker] >= amount,
                'token balance too low'
            );
        //for selling token we can identify if seller has enough tokens but while buy market order
        //we cannot determine the price at which the market order will be full filled because
        //one order can have a number of trades under it i.e. market orders can be fulfilled partially
        //as per availability in order book 
        }
        Order[] storage orders = orderBook[ticker][uint(side == Side.BUY ? Side.SELL : Side.BUY)];
        uint i;
        uint remaining = amount;
        
        //start matching market buy/sell orders agains list sell/buy resp
        while(i< orders.length && remaining > 0){
            uint available_liquidity = orders[i].amount.sub(orders[i].filled);
            uint matched = (remaining > available_liquidity) ? available_liquidity : remaining ;
            remaining = remaining.sub(matched);
            orders[i].filled = orders[i].filled.add(matched);
            emit newTrade(
                nextTradeId,
                orders[i].id,
                ticker,
                orders[i].trader, //trader that created the order in order book
                msg.sender,//trader that creates market order (caller of this fn)
                matched,
                orders[i].price,
                now        
            );
            if(side == Side.SELL){
                traderBalances[msg.sender][ticker] = traderBalances[msg.sender][ticker].sub(matched);
                traderBalances[msg.sender][DAI] = traderBalances[msg.sender][DAI].add(matched.mul(orders[i].price));
                traderBalances[orders[i].trader][ticker] = traderBalances[orders[i].trader][ticker].add(matched);
                traderBalances[orders[i].trader][DAI] = traderBalances[orders[i].trader][DAI].sub(matched.mul(orders[i].price));
            }
            if(side == Side.BUY){
                require(
                    traderBalances[msg.sender][DAI] >= matched.mul(orders[i].price),
                    'dai balance too low'
                );
                traderBalances[msg.sender][ticker] += traderBalances[msg.sender][ticker].add(matched);
                traderBalances[msg.sender][DAI] = traderBalances[msg.sender][DAI].sub(matched.mul(orders[i].price));
                traderBalances[orders[i].trader][ticker] = traderBalances[orders[i].trader][ticker].sub(matched);
                traderBalances[orders[i].trader][DAI] = traderBalances[orders[i].trader][DAI].add(matched.mul(orders[i].price));
            }
            nextTradeId = nextTradeId.add(1);
            i= i.add(1);
        }
        i=0;
        while(i < orders.length && orders[i].filled == orders[i].amount ){
            for(uint j=i ; j<orders.length-1;j++){
                orders[j]=orders[j+1];
            }
            orders.pop();
            i= i.add(1);
        }
        
        
    }
    modifier tokenIsNotDai(bytes32 ticker){
        require(ticker != DAI,'cannot trade DAI');
        _;
    }
    
    modifier tokenExist(bytes32 ticker) {
        require(tokens[ticker].tokenAddress != address(0),
        'this token does not exist');
        _;
    }
    
}