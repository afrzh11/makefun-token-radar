// Token Radar's farm plans: one plan per protocol, derived from the protocol's own record
// (category, chains, TVL, age) — never from a hand-written list of names.
//
// A plan is six steps. Each step is an action with what it costs and how long it takes, and the
// step's one-line form is "action. Cost: <cost>. Time: <time>." The costs are honest ranges, not
// promises: gas is quoted per the chain the protocol runs on, capital is tiered by the protocol's
// own TVL, and the hold is longer for younger protocols, whose qualifying window is still open.
//
// This file is plain JavaScript with no module syntax on purpose: the dashboard loads it as a
// classic script (window.Plans) and main.ts imports it as a CommonJS module, so the farm steps in
// board.json and the plans the page shows can never drift apart.

(function (root) {
  'use strict';

  /** Approximate gas for one ordinary transaction on a chain, in US dollars. */
  var GAS = {
    Ethereum: '$4–$8',
    Solana: 'under $0.05',
    Base: '$0.05–$0.30',
    Arbitrum: '$0.05–$0.30',
    Optimism: '$0.05–$0.30',
    Blast: '$0.05–$0.30',
    Linea: '$0.05–$0.30',
    Scroll: '$0.05–$0.30',
    ZKsync: '$0.05–$0.30',
    Mode: '$0.05–$0.30',
    Fraxtal: '$0.05–$0.30',
    Mantle: '$0.05–$0.30',
    'BNB Chain': '$0.10–$0.30',
    BSC: '$0.10–$0.30',
    Polygon: '$0.02–$0.05',
    Avalanche: '$0.10–$0.50',
    Hyperliquid: '$0.05–$0.20',
    HyperEVM: '$0.05–$0.20',
  };

  function gasFor(chain) {
    return GAS[chain] || 'about $0.50';
  }

  /** The first chain a protocol names, or a neutral phrase. */
  function chainOf(p) {
    return p.chains && p.chains.length > 0 ? p.chains[0] : 'its main chain';
  }

  /** How much capital one farm position needs, from the protocol's own TVL. */
  function capitalFor(p) {
    if (p.tvl_usd >= 5_000_000_000) return 250;
    if (p.tvl_usd >= 1_000_000_000) return 150;
    if (p.tvl_usd >= 100_000_000) return 100;
    return 50;
  }

  /** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
  function holdDaysFor(age) {
    if (age === null || age === undefined) return 30;
    if (age < 180) return 60;
    if (age < 365) return 45;
    return 30;
  }

  /** The category's one action, in the words a farmer can follow. */
  function actionFor(p, capital, chain) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    if (c.indexOf('curator') !== -1 || c.indexOf('allocator') !== -1) {
      return 'Deposit $' + capital + ' into a ' + name + ' vault on ' + chain + ' and keep the vault shares.';
    }
    if (c.indexOf('basis') !== -1) {
      return 'Deposit $' + capital + ' into ' + name + '\u2019s basis vault on ' + chain + ' and hold the position.';
    }
    if (c.indexOf('prediction') !== -1) {
      return 'Fund $' + capital + ' on ' + name + ' and place one market position, then leave the balance working.';
    }
    if (c.indexOf('rwa') !== -1) {
      return 'Mint $' + capital + ' of ' + name + '\u2019s yield-bearing asset on ' + chain + ' and hold it.';
    }
    if (c.indexOf('cdp manager') !== -1) {
      return 'Open a vault on ' + name + ' on ' + chain + ' with $' + capital + ' of collateral and keep it managed.';
    }
    if (c.indexOf('lending') !== -1 || c.indexOf('cdp') !== -1 || c.indexOf('collateral') !== -1 || c.indexOf('uncollateralized') !== -1) {
      return 'Supply $' + capital + ' of USDC to ' + name + ' on ' + chain + ' and borrow a small amount against it to show both sides.';
    }
    if (c.indexOf('dex') !== -1) {
      return 'Provide $' + capital + ' of liquidity to ' + name + '\u2019s main pool on ' + chain + ' and keep the position open.';
    }
    if (c.indexOf('yield aggregator') !== -1 || c.indexOf('yield') !== -1 || c.indexOf('leveraged farm') !== -1 || c.indexOf('farm') !== -1) {
      return 'Deposit $' + capital + ' into ' + name + '\u2019s main vault on ' + chain + ' and keep the shares.';
    }
    if (c.indexOf('bridge') !== -1) {
      return 'Bridge $' + capital + ' of USDC to ' + chain + ' through ' + name + ' and use the bridged funds in its app.';
    }
    if (c.indexOf('restak') !== -1 || c.indexOf('staking') !== -1) {
      return 'Stake $' + capital + ' of the chain\u2019s staking asset through ' + name + ' on ' + chain + ' and keep the receipt.';
    }
    if (c.indexOf('derivative') !== -1 || c.indexOf('perpetual') !== -1) {
      return 'Deposit $' + capital + ' of USDC as margin on ' + name + ' on ' + chain + ' and open one small hedged trade.';
    }
    if (c.indexOf('insurance') !== -1) {
      return 'Buy $' + capital + ' of cover from ' + name + ' on ' + chain + ' and keep the policy open.';
    }
    if (c.indexOf('index') !== -1) {
      return 'Buy $' + capital + ' of the ' + name + ' index basket on ' + chain + ' and hold it.';
    }
    if (c.indexOf('payment') !== -1 || c.indexOf('card') !== -1) {
      return 'Move $' + capital + ' through ' + name + ' on ' + chain + ' and use its payment rail for one real payment.';
    }
    if (c.indexOf('stable') !== -1) {
      return 'Mint or deposit $' + capital + ' of the stable asset through ' + name + ' on ' + chain + ' and hold it.';
    }
    if (c.indexOf('chain') !== -1) {
      return 'Bridge $' + capital + ' to the ' + name + ' chain and use its flagship app at least once.';
    }
    if (c.indexOf('governance') !== -1) {
      return 'Lock $' + capital + ' with ' + name + ' on ' + chain + ' and vote in one governance proposal.';
    }
    if (c.indexOf('anchor btc') !== -1 || c.indexOf('decentralized btc') !== -1) {
      return 'Mint $' + capital + ' of the BTC-backed asset through ' + name + ' on ' + chain + ' and hold it.';
    }
    if (c.indexOf('otc') !== -1) {
      return 'Complete one trade of $' + capital + ' on ' + name + ' on ' + chain + ' and leave the receipt on record.';
    }
    if (c.indexOf('cedefi') !== -1) {
      return 'Deposit $' + capital + ' into the ' + name + ' vault on ' + chain + ' and keep the position open.';
    }
    if (c.indexOf('liquidity manager') !== -1) {
      return 'Deposit $' + capital + ' into a managed liquidity position on ' + name + ' on ' + chain + ' and keep it open.';
    }
    if (c.indexOf('interest rate') !== -1) {
      return 'Open a $' + capital + ' interest-rate position on ' + name + ' on ' + chain + ' and hold it.';
    }
    return 'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and use its flagship feature once.';
  }

  /** A protocol's farm plan: six steps, each an action with a cost and a time. */
  function farmSteps(p, age) {
    var chain = chainOf(p);
    var capital = capitalFor(p);
    var gas = gasFor(chain);
    var hold = holdDaysFor(age);
    var action = actionFor(p, capital, chain);
    return [
      {
        text: 'Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.',
        cost: gas + ' of gas for the first transaction',
        time: '5 minutes',
      },
      {
        text: action,
        cost: '$' + capital + ' of capital and ' + gas + ' of gas',
        time: '15 minutes to set up',
      },
      {
        text: 'Do one qualifying action each week — a deposit, a borrow, a swap or a vote — so the wallet stays active in the protocol\u2019s own records.',
        cost: gas + ' of gas a week',
        time: '10 minutes a week',
      },
      {
        text: 'Hold the position for at least ' + hold + ' days so the activity is counted across more than one snapshot.',
        cost: 'the $' + capital + ' stays in the position',
        time: hold + ' days',
      },
      {
        text: 'Before you withdraw, open the protocol\u2019s own points or rewards page and claim only from a link it publishes; never pay to claim, and never trust a claim link from a chat or a search ad.',
        cost: 'no fee to check',
        time: '10 minutes',
      },
      {
        text: 'Write the wallet, the dates and every transaction in a farm log, so you can repeat the position or unwind it cleanly.',
        cost: 'nothing but the log',
        time: '5 minutes',
      },
    ];
  }

  /** A step as one string: its action, then its cost and time, within the gate's 20–600 characters. */
  function stepText(step) {
    var s = step.text + ' Cost: ' + step.cost + '. Time: ' + step.time + '.';
    if (s.length > 600) s = s.slice(0, 596) + '...';
    if (s.length < 20) s = s + ' Hold the position and check the protocol\u2019s own page.';
    return s;
  }

  var Plans = { farmSteps: farmSteps, stepText: stepText, gasFor: gasFor, capitalFor: capitalFor, holdDaysFor: holdDaysFor };
  if (typeof module !== 'undefined' && module.exports) module.exports = Plans;
  if (typeof window !== 'undefined') window.Plans = Plans;
  if (typeof root !== 'undefined') root.Plans = Plans;
})(typeof globalThis !== 'undefined' ? globalThis : this);
