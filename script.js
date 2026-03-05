/**
 * Blackjack Casino Experience - Game Logic
 * Implements 6-deck shoe, splitting, doubling, and professional casino rules.
 */

const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];
const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUIT_SYMBOLS = { 'spades': '♠', 'hearts': '♥', 'diamonds': '♦', 'clubs': '♣' };

// Configuration
const CONFIG = {
    numDecks: 6,
    shufflePoint: 0.25, // 25% remaining cards triggers shuffle
    blackjackPayout: 1.5,
    commonPayout: 1,
    initialBalance: 2500
};

// State
let shoe = [];
let balance = CONFIG.initialBalance;
let currentBet = 0;
let dealerHand = { cards: [], score: 0, div: document.getElementById('dealer-hand') };
let playerHands = [{ cards: [], score: 0, bet: 0, stand: false, bust: false, blackjack: false, active: true }];
let currentHandIndex = 0;
let isDealing = false;
let gameState = 'betting'; // 'betting', 'playing', 'dealer', 'gameOver'

// DOM Elements
const elements = {
    balance: document.getElementById('balance'),
    currentBet: document.getElementById('current-bet'),
    tableMessage: document.getElementById('table-message'),
    deckCount: document.getElementById('deck-count'),
    deckWarning: document.getElementById('deck-warning'),
    bettingControls: document.getElementById('betting-controls'),
    playControls: document.getElementById('play-controls'),
    dealerScore: document.getElementById('dealer-score'),
    playerScore: document.getElementById('player-score'),
    btnDeal: document.getElementById('deal-cards'),
    btnClear: document.getElementById('clear-bet'),
    btnHit: document.getElementById('hit'),
    btnStand: document.getElementById('stand'),
    btnDouble: document.getElementById('double'),
    btnSplit: document.getElementById('split'),
    shuffleOverlay: document.getElementById('shuffle-overlay'),
    playerCardsArea: document.getElementById('player-cards'),
    dealerCardsArea: document.getElementById('dealer-hand')
};

// --- CORE LOGIC ---

function createDeck() {
    const deck = [];
    for (let s = 0; s < SUITS.length; s++) {
        for (let v = 0; v < VALUES.length; v++) {
            deck.push({
                suit: SUITS[s],
                value: VALUES[v],
                id: `${SUITS[s]}-${VALUES[v]}-${Math.random().toString(36).substr(2, 9)}`
            });
        }
    }
    return deck;
}

function initShoe() {
    shoe = [];
    for (let i = 0; i < CONFIG.numDecks; i++) {
        shoe.push(...createDeck());
    }
    shuffle(shoe);
    updateDeckInfo();
}

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

function drawCard() {
    if (shoe.length < (CONFIG.numDecks * 52 * CONFIG.shufflePoint)) {
        showShuffleOverlay();
    }
    const card = shoe.pop();
    updateDeckInfo();
    return card;
}

function calculateHandValue(cards) {
    let value = 0;
    let aces = 0;

    for (const card of cards) {
        if (card.value === 'A') {
            aces += 1;
            value += 11;
        } else if (['J', 'Q', 'K'].includes(card.value)) {
            value += 10;
        } else {
            value += parseInt(card.value);
        }
    }

    while (value > 21 && aces > 0) {
        value -= 10;
        aces -= 1;
    }

    return value;
}

// --- UI UPDATES ---

function updateDeckInfo() {
    elements.deckCount.textContent = Math.ceil(shoe.length / 52);
    if (shoe.length < (CONFIG.numDecks * 52 * CONFIG.shufflePoint)) {
        elements.deckWarning.classList.remove('hidden');
    } else {
        elements.deckWarning.classList.add('hidden');
    }
}

function updateUI() {
    elements.balance.textContent = balance.toLocaleString();
    elements.currentBet.textContent = currentBet.toLocaleString();

    if (currentBet > 0 && gameState === 'betting') {
        elements.btnDeal.classList.remove('disabled');
    } else {
        elements.btnDeal.classList.add('disabled');
    }
}

function showShuffleOverlay() {
    elements.shuffleOverlay.classList.remove('hidden');
    setTimeout(() => {
        initShoe();
        elements.shuffleOverlay.classList.add('hidden');
    }, 2000);
}

function createCardElement(card, hidden = false) {
    const cardEl = document.createElement('div');
    cardEl.className = 'card' + (hidden ? ' hidden-card' : '');
    cardEl.id = `card-${card.id}`;

    // Support for 3D flip animation
    const inner = `
        <div class="card-face">
            <div class="card-value-top">
                <span>${card.value}</span>
                <span class="suit-${card.suit.slice(0, -1)}">${SUIT_SYMBOLS[card.suit]}</span>
            </div>
            <div class="card-suit-large suit-${card.suit.slice(0, -1)}">${SUIT_SYMBOLS[card.suit]}</div>
        </div>
        <div class="card-back"></div>
    `;

    cardEl.innerHTML = inner;
    if (hidden) cardEl.classList.add('flipped');

    return cardEl;
}

// --- GAME ACTIONS ---

async function deal() {
    if (currentBet === 0 || isDealing) return;

    isDealing = true;
    gameState = 'playing';
    balance -= currentBet;
    updateUI();

    // Reset hands
    playerHands = [{ cards: [], score: 0, bet: currentBet, stand: false, bust: false, blackjack: false, active: true }];
    dealerHand.cards = [];
    currentHandIndex = 0;

    elements.dealerCardsArea.innerHTML = '';
    elements.playerCardsArea.innerHTML = '';
    elements.bettingControls.classList.add('hidden');
    elements.playControls.classList.remove('hidden');
    elements.tableMessage.textContent = 'BOA SORTE!';
    elements.dealerScore.classList.add('hidden');
    elements.playerScore.classList.remove('hidden');

    // Initial deal animation (P, D, P, D)
    await addCardToHand(playerHands[0], elements.playerCardsArea);
    await sleep(250);
    await addCardToHand(dealerHand, elements.dealerCardsArea);
    await sleep(250);
    await addCardToHand(playerHands[0], elements.playerCardsArea);
    await sleep(250);
    await addCardToHand(dealerHand, elements.dealerCardsArea, true); // Dealer's hole card hidden

    // Check for natural Blackjack
    playerHands[0].score = calculateHandValue(playerHands[0].cards);
    elements.playerScore.textContent = playerHands[0].score;

    if (playerHands[0].score === 21) {
        playerHands[0].blackjack = true;
        await dealerTurn();
    } else {
        updateActionButtons();
    }

    isDealing = false;
}

async function addCardToHand(hand, container, hidden = false) {
    const card = drawCard();
    hand.cards.push(card);
    const cardEl = createCardElement(card, hidden);
    cardEl.classList.add('card-dealt');
    container.appendChild(cardEl);

    // Small delay for animation
    return new Promise(resolve => setTimeout(resolve, 300));
}

function updateActionButtons() {
    const hand = playerHands[currentHandIndex];
    if (!hand) return;

    // Split rule: same value cards on first 2 cards
    const canSplit = hand.cards.length === 2 &&
        hand.cards[0].value === hand.cards[1].value &&
        balance >= hand.bet &&
        playerHands.length < 4;

    const canDouble = hand.cards.length === 2 && balance >= hand.bet;

    if (canSplit) elements.btnSplit.classList.remove('hidden');
    else elements.btnSplit.classList.add('hidden');

    if (canDouble) elements.btnDouble.classList.remove('disabled');
    else elements.btnDouble.classList.add('disabled');
}

async function hit() {
    if (isDealing) return;
    const hand = playerHands[currentHandIndex];

    await addCardToHand(hand, elements.playerCardsArea);
    hand.score = calculateHandValue(hand.cards);
    elements.playerScore.textContent = hand.score;

    if (hand.score > 21) {
        hand.bust = true;
        elements.tableMessage.textContent = 'ESTOUROU!';
        await nextHand();
    } else if (hand.score === 21) {
        await nextHand();
    } else {
        // Can no longer double or split after hit
        elements.btnDouble.classList.add('disabled');
        elements.btnSplit.classList.add('hidden');
    }
}

async function stand() {
    if (isDealing) return;
    playerHands[currentHandIndex].stand = true;
    await nextHand();
}

async function doubleDown() {
    if (isDealing) return;
    const hand = playerHands[currentHandIndex];
    if (balance < hand.bet) return;

    balance -= hand.bet;
    hand.bet *= 2;
    updateUI();

    await addCardToHand(hand, elements.playerCardsArea);
    hand.score = calculateHandValue(hand.cards);
    elements.playerScore.textContent = hand.score;

    if (hand.score > 21) hand.bust = true;

    await nextHand();
}

async function split() {
    // Basic split implementation: move second card to new hand
    const hand = playerHands[currentHandIndex];
    if (balance < hand.bet) return;

    balance -= hand.bet;
    updateUI();

    const cardToMove = hand.cards.pop();
    const newHand = {
        cards: [cardToMove],
        score: 0,
        bet: hand.bet,
        stand: false,
        bust: false,
        blackjack: false,
        active: true
    };

    playerHands.splice(currentHandIndex + 1, 0, newHand);

    // Update UI for split
    elements.playerCardsArea.innerHTML = '';
    // Re-render both hands (simplified for single area)
    // In a full implementation, splitting would create separate Hand areas
    // For this version, we'll process them sequentially in the same area

    elements.tableMessage.textContent = 'MÃO DIVIDIDA';
    await addCardToHand(hand, elements.playerCardsArea);
    hand.score = calculateHandValue(hand.cards);
    elements.playerScore.textContent = hand.score;

    updateActionButtons();
}

async function nextHand() {
    currentHandIndex++;
    if (currentHandIndex >= playerHands.length) {
        await dealerTurn();
    } else {
        // Prepare for next hand (clear area and deal second cards)
        elements.playerCardsArea.innerHTML = '';
        const hand = playerHands[currentHandIndex];
        // Visual hand marker would go here
        await addCardToHand(hand, elements.playerCardsArea);
        hand.score = calculateHandValue(hand.cards);
        elements.playerScore.textContent = hand.score;
        updateActionButtons();
    }
}

async function dealerTurn() {
    elements.playControls.classList.add('hidden');
    gameState = 'dealer';

    // Reveal dealer card
    const hiddenCard = elements.dealerCardsArea.querySelector('.hidden-card');
    if (hiddenCard) {
        hiddenCard.classList.remove('flipped');
        hiddenCard.classList.remove('hidden-card');
    }

    dealerHand.score = calculateHandValue(dealerHand.cards);
    elements.dealerScore.classList.remove('hidden');
    elements.dealerScore.textContent = dealerHand.score;

    // If player busted/blackjack, check if dealer needs to play
    const allBusted = playerHands.every(h => h.bust);
    const allBlackjack = playerHands.every(h => h.blackjack);

    if (allBusted) {
        // No need for dealer to hit
    } else {
        while (dealerHand.score < 17) {
            await sleep(600);
            await addCardToHand(dealerHand, elements.dealerCardsArea);
            dealerHand.score = calculateHandValue(dealerHand.cards);
            elements.dealerScore.textContent = dealerHand.score;
        }
    }

    await resolveGame();
}

async function resolveGame() {
    const dScore = dealerHand.score;
    let netWinnings = 0;

    for (const hand of playerHands) {
        const pScore = hand.score;

        if (hand.bust) {
            // Player lost this hand
            continue;
        }

        if (dScore > 21) {
            // Dealer bust
            if (hand.blackjack) netWinnings += hand.bet + (hand.bet * CONFIG.blackjackPayout);
            else netWinnings += hand.bet * 2;
        } else if (pScore > dScore) {
            // Player win
            if (hand.blackjack) netWinnings += hand.bet + (hand.bet * CONFIG.blackjackPayout);
            else netWinnings += hand.bet * 2;
        } else if (pScore === dScore) {
            // Push
            if (hand.blackjack && dScore === 21 && dealerHand.cards.length === 2) {
                netWinnings += hand.bet; // Tie on Blackjack
            } else if (hand.blackjack && dScore === 21) {
                netWinnings += hand.bet + (hand.bet * CONFIG.blackjackPayout); // Player BJ beats Dealer 21
            } else if (!hand.blackjack && dScore === 21 && dealerHand.cards.length === 2) {
                // Dealer BJ beats Player 21
            } else {
                netWinnings += hand.bet;
            }
        } else {
            // Dealer win
        }
    }

    balance += netWinnings;

    // Result Message
    if (netWinnings > playerHands.reduce((a, b) => a + b.bet, 0)) {
        elements.tableMessage.textContent = 'VOCÊ VENCEU!';
    } else if (netWinnings > 0) {
        elements.tableMessage.textContent = 'EMPATE/PARCIAL';
    } else {
        elements.tableMessage.textContent = 'A BANCA VENCE';
    }

    updateUI();
    gameState = 'betting';
    currentBet = 0;
    elements.bettingControls.classList.remove('hidden');
    elements.currentBet.textContent = '0';

    if (balance <= 0) {
        elements.tableMessage.textContent = 'BANCO ZERADO! RECARREGANDO...';
        setTimeout(() => {
            balance = CONFIG.initialBalance;
            updateUI();
        }, 3000);
    }
}

// --- UTILITIES & LISTENERS ---

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Betting
document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
        if (gameState !== 'betting') return;
        const val = parseInt(chip.dataset.value);
        if (balance >= currentBet + val) {
            currentBet += val;
            chip.classList.add('chip-bouncing');
            setTimeout(() => chip.classList.remove('chip-bouncing'), 300);
            updateUI();
        }
    });
});

elements.btnClear.addEventListener('click', () => {
    if (gameState !== 'betting') return;
    currentBet = 0;
    updateUI();
});

elements.btnDeal.addEventListener('click', deal);
elements.btnHit.addEventListener('click', hit);
elements.btnStand.addEventListener('click', stand);
elements.btnDouble.addEventListener('click', doubleDown);
elements.btnSplit.addEventListener('click', split);

// Initialize
initShoe();
updateUI();
