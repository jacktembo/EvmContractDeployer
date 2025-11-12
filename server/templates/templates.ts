import type { InsertContractTemplate } from "@shared/schema";

export const TEMPLATE_CATEGORIES = {
  TOKENS: "Tokens",
  DEFI: "DeFi",
  NFT: "NFT",
  GOVERNANCE: "Governance",
  SECURITY: "Security",
  UTILITIES: "Utilities",
} as const;

export const CONTRACT_TEMPLATES: InsertContractTemplate[] = [
  {
    name: "Simple ERC20 Token",
    category: TEMPLATE_CATEGORIES.TOKENS,
    description: "Basic ERC20 fungible token with mint and burn capabilities",
    solcVersion: "0.8.20",
    tags: ["token", "erc20", "fungible", "beginner"],
    featured: true,
    sourceCode: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract SimpleToken is ERC20, Ownable {
    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply
    ) ERC20(name, symbol) Ownable(msg.sender) {
        _mint(msg.sender, initialSupply * 10 ** decimals());
    }

    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }

    function burn(uint256 amount) public {
        _burn(msg.sender, amount);
    }
}`,
  },
  {
    name: "ERC721 NFT Collection",
    category: TEMPLATE_CATEGORIES.NFT,
    description: "Standard NFT contract with URI storage and enumerable extension",
    solcVersion: "0.8.20",
    tags: ["nft", "erc721", "collectible", "intermediate"],
    featured: true,
    sourceCode: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract NFTCollection is ERC721, ERC721Enumerable, ERC721URIStorage, Ownable {
    uint256 private _nextTokenId;
    uint256 public maxSupply;

    constructor(
        string memory name,
        string memory symbol,
        uint256 _maxSupply
    ) ERC721(name, symbol) Ownable(msg.sender) {
        maxSupply = _maxSupply;
    }

    function mint(address to, string memory uri) public onlyOwner {
        require(_nextTokenId < maxSupply, "Max supply reached");
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
    }

    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721, ERC721Enumerable)
        returns (address)
    {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value)
        internal
        override(ERC721, ERC721Enumerable)
    {
        super._increaseBalance(account, value);
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}`,
  },
  {
    name: "ERC1155 Multi-Token",
    category: TEMPLATE_CATEGORIES.NFT,
    description: "Multi-token standard supporting both fungible and non-fungible tokens",
    solcVersion: "0.8.20",
    tags: ["nft", "erc1155", "multi-token", "advanced"],
    featured: false,
    sourceCode: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MultiToken is ERC1155, Ownable {
    uint256 private _currentTokenID = 0;
    mapping(uint256 => uint256) public tokenSupply;
    mapping(uint256 => string) private _tokenURIs;

    constructor() ERC1155("") Ownable(msg.sender) {}

    function mint(
        address to,
        uint256 amount,
        string memory tokenURI
    ) public onlyOwner returns (uint256) {
        uint256 newTokenID = ++_currentTokenID;
        _mint(to, newTokenID, amount, "");
        tokenSupply[newTokenID] = amount;
        _tokenURIs[newTokenID] = tokenURI;
        return newTokenID;
    }

    function mintBatch(
        address to,
        uint256[] memory amounts,
        string[] memory tokenURIs
    ) public onlyOwner returns (uint256[] memory) {
        require(amounts.length == tokenURIs.length, "Arrays length mismatch");
        
        uint256[] memory ids = new uint256[](amounts.length);
        for (uint256 i = 0; i < amounts.length; i++) {
            ids[i] = ++_currentTokenID;
            tokenSupply[ids[i]] = amounts[i];
            _tokenURIs[ids[i]] = tokenURIs[i];
        }
        
        _mintBatch(to, ids, amounts, "");
        return ids;
    }

    function uri(uint256 tokenId) public view override returns (string memory) {
        return _tokenURIs[tokenId];
    }
}`,
  },
  {
    name: "Token Sale (ICO)",
    category: TEMPLATE_CATEGORIES.DEFI,
    description: "Token sale contract with configurable price and time limits",
    solcVersion: "0.8.20",
    tags: ["ico", "crowdsale", "token-sale", "intermediate"],
    featured: true,
    sourceCode: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract TokenSale is Ownable, ReentrancyGuard {
    IERC20 public token;
    uint256 public rate; // tokens per wei
    uint256 public startTime;
    uint256 public endTime;
    uint256 public hardCap;
    uint256 public totalRaised;
    mapping(address => uint256) public contributions;

    event TokensPurchased(address indexed buyer, uint256 amount, uint256 tokens);
    event SaleFinalized(uint256 totalRaised);

    constructor(
        address tokenAddress,
        uint256 _rate,
        uint256 _startTime,
        uint256 _endTime,
        uint256 _hardCap
    ) Ownable(msg.sender) {
        require(_rate > 0, "Rate must be positive");
        require(_startTime < _endTime, "Invalid time range");
        require(_hardCap > 0, "Hard cap must be positive");
        
        token = IERC20(tokenAddress);
        rate = _rate;
        startTime = _startTime;
        endTime = _endTime;
        hardCap = _hardCap;
    }

    function buyTokens() public payable nonReentrant {
        require(block.timestamp >= startTime, "Sale not started");
        require(block.timestamp <= endTime, "Sale ended");
        require(msg.value > 0, "No ETH sent");
        require(totalRaised + msg.value <= hardCap, "Hard cap exceeded");

        uint256 tokenAmount = msg.value * rate;
        totalRaised += msg.value;
        contributions[msg.sender] += msg.value;

        require(token.transfer(msg.sender, tokenAmount), "Token transfer failed");
        emit TokensPurchased(msg.sender, msg.value, tokenAmount);
    }

    function finalizeSale() public onlyOwner {
        require(block.timestamp > endTime, "Sale not ended");
        
        uint256 remainingTokens = token.balanceOf(address(this));
        if (remainingTokens > 0) {
            token.transfer(owner(), remainingTokens);
        }
        
        payable(owner()).transfer(address(this).balance);
        emit SaleFinalized(totalRaised);
    }

    receive() external payable {
        buyTokens();
    }
}`,
  },
  {
    name: "Token Vesting",
    category: TEMPLATE_CATEGORIES.DEFI,
    description: "Time-locked token vesting contract with cliff and linear release",
    solcVersion: "0.8.20",
    tags: ["vesting", "timelock", "token-release", "intermediate"],
    featured: false,
    sourceCode: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract TokenVesting is Ownable {
    struct VestingSchedule {
        uint256 totalAmount;
        uint256 releasedAmount;
        uint256 startTime;
        uint256 cliff;
        uint256 duration;
    }

    IERC20 public token;
    mapping(address => VestingSchedule) public schedules;

    event VestingScheduleCreated(address indexed beneficiary, uint256 amount);
    event TokensReleased(address indexed beneficiary, uint256 amount);

    constructor(address tokenAddress) Ownable(msg.sender) {
        token = IERC20(tokenAddress);
    }

    function createVestingSchedule(
        address beneficiary,
        uint256 amount,
        uint256 cliff,
        uint256 duration
    ) public onlyOwner {
        require(schedules[beneficiary].totalAmount == 0, "Schedule exists");
        require(amount > 0, "Amount must be positive");
        require(duration > 0, "Duration must be positive");
        require(cliff < duration, "Cliff exceeds duration");

        schedules[beneficiary] = VestingSchedule({
            totalAmount: amount,
            releasedAmount: 0,
            startTime: block.timestamp,
            cliff: cliff,
            duration: duration
        });

        require(token.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        emit VestingScheduleCreated(beneficiary, amount);
    }

    function release() public {
        VestingSchedule storage schedule = schedules[msg.sender];
        require(schedule.totalAmount > 0, "No vesting schedule");
        require(block.timestamp >= schedule.startTime + schedule.cliff, "Cliff not reached");

        uint256 vested = vestedAmount(msg.sender);
        uint256 releasable = vested - schedule.releasedAmount;
        require(releasable > 0, "No tokens to release");

        schedule.releasedAmount += releasable;
        require(token.transfer(msg.sender, releasable), "Transfer failed");
        emit TokensReleased(msg.sender, releasable);
    }

    function vestedAmount(address beneficiary) public view returns (uint256) {
        VestingSchedule memory schedule = schedules[beneficiary];
        if (block.timestamp < schedule.startTime + schedule.cliff) {
            return 0;
        } else if (block.timestamp >= schedule.startTime + schedule.duration) {
            return schedule.totalAmount;
        } else {
            uint256 elapsed = block.timestamp - schedule.startTime;
            return (schedule.totalAmount * elapsed) / schedule.duration;
        }
    }
}`,
  },
  {
    name: "Staking Rewards",
    category: TEMPLATE_CATEGORIES.DEFI,
    description: "Stake tokens to earn rewards over time with flexible withdrawal",
    solcVersion: "0.8.20",
    tags: ["staking", "rewards", "yield", "advanced"],
    featured: true,
    sourceCode: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract StakingRewards is Ownable, ReentrancyGuard {
    IERC20 public stakingToken;
    IERC20 public rewardToken;
    
    uint256 public rewardRate; // rewards per second
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;
    uint256 public totalStaked;
    
    mapping(address => uint256) public balances;
    mapping(address => uint256) public rewards;
    mapping(address => uint256) public userRewardPerTokenPaid;

    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);

    constructor(
        address _stakingToken,
        address _rewardToken,
        uint256 _rewardRate
    ) Ownable(msg.sender) {
        stakingToken = IERC20(_stakingToken);
        rewardToken = IERC20(_rewardToken);
        rewardRate = _rewardRate;
    }

    function rewardPerToken() public view returns (uint256) {
        if (totalStaked == 0) {
            return rewardPerTokenStored;
        }
        return rewardPerTokenStored + (
            (block.timestamp - lastUpdateTime) * rewardRate * 1e18 / totalStaked
        );
    }

    function earned(address account) public view returns (uint256) {
        return (balances[account] * (rewardPerToken() - userRewardPerTokenPaid[account]) / 1e18) + rewards[account];
    }

    modifier updateReward(address account) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = block.timestamp;
        if (account != address(0)) {
            rewards[account] = earned(account);
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
        _;
    }

    function stake(uint256 amount) external nonReentrant updateReward(msg.sender) {
        require(amount > 0, "Cannot stake 0");
        totalStaked += amount;
        balances[msg.sender] += amount;
        stakingToken.transferFrom(msg.sender, address(this), amount);
        emit Staked(msg.sender, amount);
    }

    function withdraw(uint256 amount) public nonReentrant updateReward(msg.sender) {
        require(amount > 0, "Cannot withdraw 0");
        require(balances[msg.sender] >= amount, "Insufficient balance");
        totalStaked -= amount;
        balances[msg.sender] -= amount;
        stakingToken.transfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    function getReward() public nonReentrant updateReward(msg.sender) {
        uint256 reward = rewards[msg.sender];
        if (reward > 0) {
            rewards[msg.sender] = 0;
            rewardToken.transfer(msg.sender, reward);
            emit RewardPaid(msg.sender, reward);
        }
    }

    function exit() external {
        withdraw(balances[msg.sender]);
        getReward();
    }

    function setRewardRate(uint256 _rewardRate) external onlyOwner updateReward(address(0)) {
        rewardRate = _rewardRate;
    }
}`,
  },
  {
    name: "MultiSig Wallet",
    category: TEMPLATE_CATEGORIES.SECURITY,
    description: "Multi-signature wallet requiring M-of-N approvals for transactions",
    solcVersion: "0.8.20",
    tags: ["multisig", "security", "wallet", "advanced"],
    featured: true,
    sourceCode: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MultiSigWallet {
    event Deposit(address indexed sender, uint256 amount);
    event Submit(uint256 indexed txId);
    event Approve(address indexed owner, uint256 indexed txId);
    event Revoke(address indexed owner, uint256 indexed txId);
    event Execute(uint256 indexed txId);

    struct Transaction {
        address to;
        uint256 value;
        bytes data;
        bool executed;
    }

    address[] public owners;
    mapping(address => bool) public isOwner;
    uint256 public required;

    Transaction[] public transactions;
    mapping(uint256 => mapping(address => bool)) public approved;

    modifier onlyOwner() {
        require(isOwner[msg.sender], "Not owner");
        _;
    }

    modifier txExists(uint256 _txId) {
        require(_txId < transactions.length, "Tx does not exist");
        _;
    }

    modifier notExecuted(uint256 _txId) {
        require(!transactions[_txId].executed, "Tx already executed");
        _;
    }

    modifier notApproved(uint256 _txId) {
        require(!approved[_txId][msg.sender], "Tx already approved");
        _;
    }

    constructor(address[] memory _owners, uint256 _required) {
        require(_owners.length > 0, "Owners required");
        require(_required > 0 && _required <= _owners.length, "Invalid required number");

        for (uint256 i = 0; i < _owners.length; i++) {
            address owner = _owners[i];
            require(owner != address(0), "Invalid owner");
            require(!isOwner[owner], "Owner not unique");

            isOwner[owner] = true;
            owners.push(owner);
        }

        required = _required;
    }

    receive() external payable {
        emit Deposit(msg.sender, msg.value);
    }

    function submit(address _to, uint256 _value, bytes calldata _data) external onlyOwner {
        transactions.push(Transaction({
            to: _to,
            value: _value,
            data: _data,
            executed: false
        }));
        emit Submit(transactions.length - 1);
    }

    function approve(uint256 _txId)
        external
        onlyOwner
        txExists(_txId)
        notExecuted(_txId)
        notApproved(_txId)
    {
        approved[_txId][msg.sender] = true;
        emit Approve(msg.sender, _txId);
    }

    function execute(uint256 _txId) external txExists(_txId) notExecuted(_txId) {
        require(_getApprovalCount(_txId) >= required, "Not enough approvals");
        Transaction storage transaction = transactions[_txId];
        transaction.executed = true;
        (bool success, ) = transaction.to.call{value: transaction.value}(transaction.data);
        require(success, "Tx failed");
        emit Execute(_txId);
    }

    function revoke(uint256 _txId) external onlyOwner txExists(_txId) notExecuted(_txId) {
        require(approved[_txId][msg.sender], "Tx not approved");
        approved[_txId][msg.sender] = false;
        emit Revoke(msg.sender, _txId);
    }

    function _getApprovalCount(uint256 _txId) private view returns (uint256 count) {
        for (uint256 i = 0; i < owners.length; i++) {
            if (approved[_txId][owners[i]]) {
                count += 1;
            }
        }
    }

    function getOwners() external view returns (address[] memory) {
        return owners;
    }

    function getTransactionCount() external view returns (uint256) {
        return transactions.length;
    }

    function getTransaction(uint256 _txId) external view returns (
        address to,
        uint256 value,
        bytes memory data,
        bool executed,
        uint256 approvals
    ) {
        Transaction memory transaction = transactions[_txId];
        return (
            transaction.to,
            transaction.value,
            transaction.data,
            transaction.executed,
            _getApprovalCount(_txId)
        );
    }
}`,
  },
  {
    name: "Timelock Controller",
    category: TEMPLATE_CATEGORIES.GOVERNANCE,
    description: "Delay execution of transactions for governance security",
    solcVersion: "0.8.20",
    tags: ["timelock", "governance", "delay", "advanced"],
    featured: false,
    sourceCode: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract TimelockController {
    event Queue(
        bytes32 indexed txHash,
        address indexed target,
        uint256 value,
        string func,
        bytes data,
        uint256 timestamp
    );
    event Execute(
        bytes32 indexed txHash,
        address indexed target,
        uint256 value,
        string func,
        bytes data,
        uint256 timestamp
    );
    event Cancel(bytes32 indexed txHash);

    uint256 public constant MIN_DELAY = 10; // 10 seconds
    uint256 public constant MAX_DELAY = 7 days;
    uint256 public constant GRACE_PERIOD = 7 days;

    address public admin;
    uint256 public delay;
    mapping(bytes32 => bool) public queued;

    modifier onlyAdmin() {
        require(msg.sender == admin, "Not admin");
        _;
    }

    constructor(uint256 _delay) {
        require(_delay >= MIN_DELAY && _delay <= MAX_DELAY, "Invalid delay");
        admin = msg.sender;
        delay = _delay;
    }

    function getTxHash(
        address target,
        uint256 value,
        string calldata func,
        bytes calldata data,
        uint256 timestamp
    ) public pure returns (bytes32) {
        return keccak256(abi.encode(target, value, func, data, timestamp));
    }

    function queue(
        address target,
        uint256 value,
        string calldata func,
        bytes calldata data,
        uint256 timestamp
    ) external onlyAdmin {
        bytes32 txHash = getTxHash(target, value, func, data, timestamp);
        require(!queued[txHash], "Already queued");
        require(timestamp >= block.timestamp + delay, "Timestamp too early");

        queued[txHash] = true;
        emit Queue(txHash, target, value, func, data, timestamp);
    }

    function execute(
        address target,
        uint256 value,
        string calldata func,
        bytes calldata data,
        uint256 timestamp
    ) external payable onlyAdmin returns (bytes memory) {
        bytes32 txHash = getTxHash(target, value, func, data, timestamp);
        
        require(queued[txHash], "Not queued");
        require(block.timestamp >= timestamp, "Too early");
        require(block.timestamp <= timestamp + GRACE_PERIOD, "Expired");

        queued[txHash] = false;

        bytes memory callData;
        if (bytes(func).length > 0) {
            callData = abi.encodePacked(bytes4(keccak256(bytes(func))), data);
        } else {
            callData = data;
        }

        (bool success, bytes memory result) = target.call{value: value}(callData);
        require(success, "Execution failed");

        emit Execute(txHash, target, value, func, data, timestamp);
        return result;
    }

    function cancel(
        address target,
        uint256 value,
        string calldata func,
        bytes calldata data,
        uint256 timestamp
    ) external onlyAdmin {
        bytes32 txHash = getTxHash(target, value, func, data, timestamp);
        require(queued[txHash], "Not queued");

        queued[txHash] = false;
        emit Cancel(txHash);
    }
}`,
  },
  {
    name: "DAO Governor",
    category: TEMPLATE_CATEGORIES.GOVERNANCE,
    description: "On-chain governance with proposal voting and execution",
    solcVersion: "0.8.20",
    tags: ["dao", "governance", "voting", "advanced"],
    featured: true,
    sourceCode: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract DAOGovernor {
    struct Proposal {
        address proposer;
        string description;
        uint256 forVotes;
        uint256 againstVotes;
        uint256 startBlock;
        uint256 endBlock;
        bool executed;
        bool canceled;
        mapping(address => bool) hasVoted;
    }

    IERC20 public governanceToken;
    uint256 public proposalCount;
    uint256 public votingDelay = 1; // blocks
    uint256 public votingPeriod = 50400; // ~1 week with 12s blocks
    uint256 public proposalThreshold = 100000e18; // min tokens to propose
    uint256 public quorum = 4; // 4% of total supply needed

    mapping(uint256 => Proposal) public proposals;

    event ProposalCreated(uint256 indexed proposalId, address indexed proposer, string description);
    event VoteCast(address indexed voter, uint256 indexed proposalId, bool support, uint256 votes);
    event ProposalExecuted(uint256 indexed proposalId);
    event ProposalCanceled(uint256 indexed proposalId);

    constructor(address _governanceToken) {
        governanceToken = IERC20(_governanceToken);
    }

    function propose(string memory description) external returns (uint256) {
        require(
            governanceToken.balanceOf(msg.sender) >= proposalThreshold,
            "Below proposal threshold"
        );

        uint256 proposalId = ++proposalCount;
        Proposal storage proposal = proposals[proposalId];
        proposal.proposer = msg.sender;
        proposal.description = description;
        proposal.startBlock = block.number + votingDelay;
        proposal.endBlock = block.number + votingDelay + votingPeriod;

        emit ProposalCreated(proposalId, msg.sender, description);
        return proposalId;
    }

    function castVote(uint256 proposalId, bool support) external {
        Proposal storage proposal = proposals[proposalId];
        require(block.number >= proposal.startBlock, "Voting not started");
        require(block.number <= proposal.endBlock, "Voting ended");
        require(!proposal.hasVoted[msg.sender], "Already voted");

        uint256 votes = governanceToken.balanceOf(msg.sender);
        require(votes > 0, "No voting power");

        proposal.hasVoted[msg.sender] = true;

        if (support) {
            proposal.forVotes += votes;
        } else {
            proposal.againstVotes += votes;
        }

        emit VoteCast(msg.sender, proposalId, support, votes);
    }

    function execute(uint256 proposalId) external {
        Proposal storage proposal = proposals[proposalId];
        require(block.number > proposal.endBlock, "Voting not ended");
        require(!proposal.executed, "Already executed");
        require(!proposal.canceled, "Proposal canceled");

        uint256 totalSupply = governanceToken.totalSupply();
        uint256 quorumVotes = (totalSupply * quorum) / 100;
        
        require(
            proposal.forVotes + proposal.againstVotes >= quorumVotes,
            "Quorum not reached"
        );
        require(proposal.forVotes > proposal.againstVotes, "Proposal defeated");

        proposal.executed = true;
        emit ProposalExecuted(proposalId);
    }

    function cancel(uint256 proposalId) external {
        Proposal storage proposal = proposals[proposalId];
        require(msg.sender == proposal.proposer, "Not proposer");
        require(!proposal.executed, "Already executed");
        require(block.number <= proposal.endBlock, "Voting ended");

        proposal.canceled = true;
        emit ProposalCanceled(proposalId);
    }

    function getProposal(uint256 proposalId) external view returns (
        address proposer,
        string memory description,
        uint256 forVotes,
        uint256 againstVotes,
        uint256 startBlock,
        uint256 endBlock,
        bool executed,
        bool canceled
    ) {
        Proposal storage proposal = proposals[proposalId];
        return (
            proposal.proposer,
            proposal.description,
            proposal.forVotes,
            proposal.againstVotes,
            proposal.startBlock,
            proposal.endBlock,
            proposal.executed,
            proposal.canceled
        );
    }
}`,
  },
  {
    name: "Escrow Contract",
    category: TEMPLATE_CATEGORIES.SECURITY,
    description: "Trustless escrow for secure peer-to-peer transactions",
    solcVersion: "0.8.20",
    tags: ["escrow", "payment", "security", "intermediate"],
    featured: false,
    sourceCode: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Escrow {
    enum State { AWAITING_PAYMENT, AWAITING_DELIVERY, COMPLETE, REFUNDED }

    struct Transaction {
        address payable buyer;
        address payable seller;
        uint256 amount;
        State state;
    }

    mapping(uint256 => Transaction) public transactions;
    uint256 public transactionCount;

    event TransactionCreated(uint256 indexed txId, address buyer, address seller, uint256 amount);
    event PaymentReceived(uint256 indexed txId);
    event DeliveryConfirmed(uint256 indexed txId);
    event Refunded(uint256 indexed txId);

    function createTransaction(address payable seller) external payable returns (uint256) {
        require(msg.value > 0, "Payment required");
        require(seller != address(0), "Invalid seller");
        require(seller != msg.sender, "Buyer cannot be seller");

        uint256 txId = transactionCount++;
        transactions[txId] = Transaction({
            buyer: payable(msg.sender),
            seller: seller,
            amount: msg.value,
            state: State.AWAITING_DELIVERY
        });

        emit TransactionCreated(txId, msg.sender, seller, msg.value);
        emit PaymentReceived(txId);
        return txId;
    }

    function confirmDelivery(uint256 txId) external {
        Transaction storage txn = transactions[txId];
        require(msg.sender == txn.buyer, "Only buyer can confirm");
        require(txn.state == State.AWAITING_DELIVERY, "Invalid state");

        txn.state = State.COMPLETE;
        txn.seller.transfer(txn.amount);

        emit DeliveryConfirmed(txId);
    }

    function refund(uint256 txId) external {
        Transaction storage txn = transactions[txId];
        require(msg.sender == txn.seller, "Only seller can refund");
        require(txn.state == State.AWAITING_DELIVERY, "Invalid state");

        txn.state = State.REFUNDED;
        txn.buyer.transfer(txn.amount);

        emit Refunded(txId);
    }
}`,
  },
  {
    name: "Payment Splitter",
    category: TEMPLATE_CATEGORIES.UTILITIES,
    description: "Split incoming payments among multiple payees",
    solcVersion: "0.8.20",
    tags: ["payment", "split", "revenue", "intermediate"],
    featured: false,
    sourceCode: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract PaymentSplitter {
    address[] public payees;
    mapping(address => uint256) public shares;
    mapping(address => uint256) public released;
    uint256 public totalShares;
    uint256 public totalReleased;

    event PaymentReleased(address indexed to, uint256 amount);
    event PaymentReceived(address indexed from, uint256 amount);

    constructor(address[] memory _payees, uint256[] memory _shares) {
        require(_payees.length == _shares.length, "Arrays length mismatch");
        require(_payees.length > 0, "No payees");

        for (uint256 i = 0; i < _payees.length; i++) {
            require(_payees[i] != address(0), "Invalid payee");
            require(_shares[i] > 0, "Shares must be positive");
            require(shares[_payees[i]] == 0, "Duplicate payee");

            payees.push(_payees[i]);
            shares[_payees[i]] = _shares[i];
            totalShares += _shares[i];
        }
    }

    receive() external payable {
        emit PaymentReceived(msg.sender, msg.value);
    }

    function release(address payable account) public {
        require(shares[account] > 0, "Account has no shares");

        uint256 totalReceived = address(this).balance + totalReleased;
        uint256 payment = (totalReceived * shares[account]) / totalShares - released[account];

        require(payment > 0, "Account not due payment");

        released[account] += payment;
        totalReleased += payment;

        account.transfer(payment);
        emit PaymentReleased(account, payment);
    }

    function releaseAll() external {
        for (uint256 i = 0; i < payees.length; i++) {
            if (shares[payees[i]] > 0) {
                release(payable(payees[i]));
            }
        }
    }

    function getPendingPayment(address account) public view returns (uint256) {
        uint256 totalReceived = address(this).balance + totalReleased;
        return (totalReceived * shares[account]) / totalShares - released[account];
    }
}`,
  },
  {
    name: "Lottery Contract",
    category: TEMPLATE_CATEGORIES.UTILITIES,
    description: "Provably fair lottery with random winner selection",
    solcVersion: "0.8.20",
    tags: ["lottery", "random", "game", "intermediate"],
    featured: false,
    sourceCode: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Lottery {
    address public manager;
    address payable[] public players;
    uint256 public ticketPrice;
    bool public isActive;

    event PlayerEntered(address indexed player);
    event WinnerPicked(address indexed winner, uint256 prize);
    event LotteryStarted(uint256 ticketPrice);
    event LotteryEnded();

    constructor(uint256 _ticketPrice) {
        manager = msg.sender;
        ticketPrice = _ticketPrice;
        isActive = true;
    }

    function enter() external payable {
        require(isActive, "Lottery not active");
        require(msg.value == ticketPrice, "Incorrect ticket price");

        players.push(payable(msg.sender));
        emit PlayerEntered(msg.sender);
    }

    function random() private view returns (uint256) {
        return uint256(keccak256(abi.encodePacked(
            block.difficulty,
            block.timestamp,
            players.length
        )));
    }

    function pickWinner() external {
        require(msg.sender == manager, "Only manager can pick winner");
        require(players.length > 0, "No players");
        require(isActive, "Lottery not active");

        uint256 index = random() % players.length;
        address payable winner = players[index];
        uint256 prize = address(this).balance;

        winner.transfer(prize);
        emit WinnerPicked(winner, prize);

        // Reset for next round
        players = new address payable[](0);
    }

    function endLottery() external {
        require(msg.sender == manager, "Only manager");
        isActive = false;
        emit LotteryEnded();
    }

    function getPlayers() external view returns (address payable[] memory) {
        return players;
    }

    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }

    function getPlayerCount() external view returns (uint256) {
        return players.length;
    }
}`,
  },
  {
    name: "Dutch Auction",
    category: TEMPLATE_CATEGORIES.DEFI,
    description: "Price decreases over time until item is sold",
    solcVersion: "0.8.20",
    tags: ["auction", "dutch", "price-discovery", "advanced"],
    featured: false,
    sourceCode: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

contract DutchAuction {
    IERC721 public nft;
    uint256 public nftId;
    address payable public seller;
    uint256 public startingPrice;
    uint256 public discountRate;
    uint256 public startAt;
    uint256 public expiresAt;

    event AuctionEnded(address winner, uint256 price);

    constructor(
        uint256 _startingPrice,
        uint256 _discountRate,
        address _nft,
        uint256 _nftId
    ) {
        seller = payable(msg.sender);
        startingPrice = _startingPrice;
        discountRate = _discountRate;
        startAt = block.timestamp;
        expiresAt = block.timestamp + 7 days;
        
        nft = IERC721(_nft);
        nftId = _nftId;
    }

    function getPrice() public view returns (uint256) {
        if (block.timestamp >= expiresAt) {
            return 0;
        }
        
        uint256 timeElapsed = block.timestamp - startAt;
        uint256 discount = discountRate * timeElapsed;
        
        if (discount >= startingPrice) {
            return 0;
        }
        
        return startingPrice - discount;
    }

    function buy() external payable {
        require(block.timestamp < expiresAt, "Auction expired");

        uint256 price = getPrice();
        require(msg.value >= price, "Insufficient payment");

        nft.transferFrom(seller, msg.sender, nftId);
        
        uint256 refund = msg.value - price;
        if (refund > 0) {
            payable(msg.sender).transfer(refund);
        }
        
        seller.transfer(price);
        emit AuctionEnded(msg.sender, price);
        
        selfdestruct(seller);
    }
}`,
  },
  {
    name: "NFT Marketplace",
    category: TEMPLATE_CATEGORIES.NFT,
    description: "Buy and sell NFTs with listing and offer system",
    solcVersion: "0.8.20",
    tags: ["marketplace", "nft", "trading", "advanced"],
    featured: true,
    sourceCode: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract NFTMarketplace is ReentrancyGuard {
    struct Listing {
        address seller;
        uint256 price;
        bool active;
    }

    struct Offer {
        address offerer;
        uint256 price;
        bool active;
    }

    uint256 public feePercent = 2; // 2% marketplace fee
    address public feeRecipient;

    mapping(address => mapping(uint256 => Listing)) public listings;
    mapping(address => mapping(uint256 => Offer[])) public offers;

    event Listed(address indexed nft, uint256 indexed tokenId, address seller, uint256 price);
    event Unlisted(address indexed nft, uint256 indexed tokenId);
    event Sold(address indexed nft, uint256 indexed tokenId, address buyer, uint256 price);
    event OfferMade(address indexed nft, uint256 indexed tokenId, address offerer, uint256 price);
    event OfferAccepted(address indexed nft, uint256 indexed tokenId, uint256 offerIndex);

    constructor() {
        feeRecipient = msg.sender;
    }

    function list(address nft, uint256 tokenId, uint256 price) external {
        require(price > 0, "Price must be positive");
        require(IERC721(nft).ownerOf(tokenId) == msg.sender, "Not owner");
        require(
            IERC721(nft).getApproved(tokenId) == address(this) ||
            IERC721(nft).isApprovedForAll(msg.sender, address(this)),
            "Not approved"
        );

        listings[nft][tokenId] = Listing({
            seller: msg.sender,
            price: price,
            active: true
        });

        emit Listed(nft, tokenId, msg.sender, price);
    }

    function unlist(address nft, uint256 tokenId) external {
        Listing storage listing = listings[nft][tokenId];
        require(listing.seller == msg.sender, "Not seller");
        require(listing.active, "Not listed");

        listing.active = false;
        emit Unlisted(nft, tokenId);
    }

    function buy(address nft, uint256 tokenId) external payable nonReentrant {
        Listing storage listing = listings[nft][tokenId];
        require(listing.active, "Not listed");
        require(msg.value >= listing.price, "Insufficient payment");

        listing.active = false;

        uint256 fee = (listing.price * feePercent) / 100;
        uint256 sellerAmount = listing.price - fee;

        IERC721(nft).safeTransferFrom(listing.seller, msg.sender, tokenId);
        
        payable(listing.seller).transfer(sellerAmount);
        payable(feeRecipient).transfer(fee);

        if (msg.value > listing.price) {
            payable(msg.sender).transfer(msg.value - listing.price);
        }

        emit Sold(nft, tokenId, msg.sender, listing.price);
    }

    function makeOffer(address nft, uint256 tokenId) external payable {
        require(msg.value > 0, "Offer must be positive");

        offers[nft][tokenId].push(Offer({
            offerer: msg.sender,
            price: msg.value,
            active: true
        }));

        emit OfferMade(nft, tokenId, msg.sender, msg.value);
    }

    function acceptOffer(address nft, uint256 tokenId, uint256 offerIndex) external nonReentrant {
        require(IERC721(nft).ownerOf(tokenId) == msg.sender, "Not owner");
        
        Offer storage offer = offers[nft][tokenId][offerIndex];
        require(offer.active, "Offer not active");

        offer.active = false;

        uint256 fee = (offer.price * feePercent) / 100;
        uint256 sellerAmount = offer.price - fee;

        IERC721(nft).safeTransferFrom(msg.sender, offer.offerer, tokenId);
        
        payable(msg.sender).transfer(sellerAmount);
        payable(feeRecipient).transfer(fee);

        emit OfferAccepted(nft, tokenId, offerIndex);
    }

    function getOffers(address nft, uint256 tokenId) external view returns (Offer[] memory) {
        return offers[nft][tokenId];
    }
}`,
  },
  {
    name: "UUPS Upgradeable Proxy",
    category: TEMPLATE_CATEGORIES.SECURITY,
    description: "Upgradeable smart contract using UUPS proxy pattern",
    solcVersion: "0.8.20",
    tags: ["proxy", "upgradeable", "uups", "advanced"],
    featured: false,
    sourceCode: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract MyUpgradeableContract is Initializable, UUPSUpgradeable, OwnableUpgradeable {
    uint256 public value;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(uint256 _initialValue) public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        value = _initialValue;
    }

    function setValue(uint256 _newValue) public onlyOwner {
        value = _newValue;
    }

    function getValue() public view returns (uint256) {
        return value;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    function version() public pure virtual returns (string memory) {
        return "v1.0.0";
    }
}`,
  },
  {
    name: "Ownable Access Control",
    category: TEMPLATE_CATEGORIES.SECURITY,
    description: "Basic access control using Ownable and AccessControl patterns",
    solcVersion: "0.8.20",
    tags: ["access", "ownable", "roles", "permissions", "security", "beginner"],
    featured: true,
    sourceCode: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract ManagedContract is Ownable, AccessControl {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    
    uint256 public value;
    
    event ValueUpdated(uint256 newValue, address updatedBy);
    
    constructor() Ownable(msg.sender) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }
    
    function addAdmin(address account) public onlyOwner {
        grantRole(ADMIN_ROLE, account);
    }
    
    function addOperator(address account) public onlyRole(ADMIN_ROLE) {
        grantRole(OPERATOR_ROLE, account);
    }
    
    function removeOperator(address account) public onlyRole(ADMIN_ROLE) {
        revokeRole(OPERATOR_ROLE, account);
    }
    
    function setValue(uint256 newValue) public onlyRole(OPERATOR_ROLE) {
        value = newValue;
        emit ValueUpdated(newValue, msg.sender);
    }
    
    function emergencyPause() public onlyOwner {
        // Emergency function only owner can call
    }
}`,
  },
];
