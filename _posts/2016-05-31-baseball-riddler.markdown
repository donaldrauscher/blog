---
layout: post
title:  "538 Riddler: Puzzle of Baseball Divisional Champs"
date:   2015-05-26
categories: 538, fivethirtyeight, riddler
tags: 538, fivethirtyeight, riddler, baseball
permalink: /baseball-riddler
---

For [this week's Riddler](http://fivethirtyeight.com/features/can-you-solve-the-puzzle-of-the-baseball-division-champs/), I estimated that the division leader would have 88.8 wins after 162 games.  I assumed that each team plays the other teams in it's division 19 times for a total of 76 intradivision games and 86 interdivision games, consistent with the [actual scheduling rules](https://en.wikipedia.org/wiki/Major_League_Baseball_schedule). 

Interdivision games are pretty easy to deal with because the outcomes of each team's interdivision games are independent of one another. If all 162 games were interdivision, the answer would be pretty straightforward (code is in R):

```R
> cdf <- (pbinom(1:162, 162, 0.5))^5
> pmf <- cdf - c(0, head(cdf, -1))
> sum(1:162 * pmf)
[1] 88.39431
```

Unfortunately, we don't have independence for intradivision games.  We can think of intradivision games as a series of consecutive round robins.  In each round robin, there are 10 games, and each team plays in 4 of those games.  I couldn't find a neat way to express the win distribution of the divisional leader(s), so I kind of brute-forced it with R.  I wrote some code to calculate an exhaustive state space with each state's corresponding probability after the 190 intradivision games.  Because all the teams are evenly matched, each state can be defined in order from most wins to least wins, greatly reducing the size of our state space.  So we define each state <span class="inline-equation" data-expr="s = \left(t_{1},t_{2},t_{3},t_{4},t_{5}\right)"></span> such that <span class="inline-equation" data-expr="t_{1} \geq t_{2} \geq t_{3} \geq t_{4} \geq t_{5}"></span>.  Even with this trick, there were 157,470 states in my state space!

We can define the CDF as follows:
{% raw %}
<div class="equation" data-expr="CDF \left( x \right) = \sum_{s \in \mathbb{S}} P\left( s \right) * P \left( X \leq \left( x - s \right) \right)"></div>
<div class="equation" data-expr="= \sum_{s \in \mathbb{S}} P\left( s \right) * \prod_{i = 1}^{i = 5} P \left( X \leq \left( x - t_{i} \right) \right) \quad where \quad X \sim B \left( 86, 0.5 \right) \quad \forall x \in \left[ 38, 162 \right]"></div>
{% endraw %}

<img src="/img/win_distribution.jpeg" style='display:block; margin-left: auto; margin-right: auto;'>

This computes to 88.8 wins.  This is slightly higher than the all-interdivision calculation above, which makes intuitive sense.  In the all-interdivision scenario, we could theoretically have a division leader with 0 wins (all 5 teams go undefeated).  However, when we have intradivision games, the division leader cannot have fewer wins than the number of intradivision games that they play divided by 2; one team's loss is another team's win.

I've posted [my code](https://github.com/donaldrauscher/baseball-riddler) on my Github.  Enjoy!
