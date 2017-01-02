---
layout: post
title:  "538 Riddler: Dice Poker Riddler"
date:   2017-01-01
categories: 538, fivethirtyeight, riddler, game_theory
tags: 538, fivethirtyeight, riddler, game_theory
permalink: /dice-poker-riddler
---

In [this week's Riddler](http://fivethirtyeight.com/features/can-you-deal-with-these-card-game-puzzles/), we have a game theory problem. Both players have an advantage.  Player A dictates the pot size; player B cannot increase the pot size if player A calls.  However, player B has more information.  If player A raises, this signals to player B that they have a high roll. Player B then has the option to fold if they have a low roll or call if they have a high roll.  It makes sense for player B to have at least the same call threshold as player A's raise threshold. However, it is a trade-off; if player B has too high of a call threshold, they forfeit hands that they might otherwise win or draw on.  Here are the player A payoffs (player B payoffs are simply the inverse because this is a zero sum game) when A raises if they have >=3 and B calls if they have >=4:
[<img src="/img/dice-poker-A3vB4.png" style="display:block; margin-left:auto; margin-right:auto;">](/img/dice-poker-A3vB4.png)

Player B has a slight advantage here; player B's expected winnings are $0.06 while player A's expected winnings are -$0.06. However, this is not a Nash Equilibrium since player A has an incentive to deviate.

We can find the Nash by working backwards.  We first determine the optimal player B strategy for each of the possible player A strategies.  Then, pick the optimal A strategy assuming B reacts optimally.  Here are the results:
[<img src="/img/dice-poker-nash.png" style="display:block; margin-left:auto; margin-right:auto;">](/img/dice-poker-nash.png)

As expected, the optimal B strategy is consistently higher than the optimal A strategy.  However, player B's advantage diminishes as player A's strategy increases.  At best, player A can make the game even, each player having expected winnings of $0 (so player A doesn't need to pay player B anything to play).  Player A's strategy will be to raise if they have a 5 or 6.  Player B's strategy will be to call if they have a 6.  This gives us two Nash Equilibria: (5,6) and (6, 6).

<a href="/files/Dice Poker Riddler vF.xlsx" target="_blank">This Excel document</a> details my work.  Cheers!
