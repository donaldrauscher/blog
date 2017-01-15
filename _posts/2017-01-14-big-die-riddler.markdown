---
layout: post
title: '538 Riddler: 100-Sided Die'
date:   2017-01-14
categories: 538, fivethirtyeight, riddler
tags: '538, fivethirtyeight, riddler, probability'
permalink: /big-die
---
This week's [Riddler](https://fivethirtyeight.com/features/how-long-will-it-take-to-blow-out-the-birthday-candles/) revolves around a game played with a 100-sided die (I seriously want one).  I started by thinking about the problem as an absorbing Markov Chain with 101 states, 1 state for the end of the game and 100 games for each potential roll.  The transition probability matrix is the following:
{% raw %}
<div class="equation" data-expr="
P = \begin{bmatrix}
 & \frac{1}{100} & \frac{1}{100} & \frac{1}{100} & \cdots & \frac{1}{100} & 0 & \\[0.8em]
 & 0 & \frac{1}{100} & \frac{1}{100} & \cdots & \frac{1}{100} & \frac{1}{100} & \\[0.8em]
 & 0 & 0 & \frac{1}{100} & \cdots & \frac{1}{100} & \frac{2}{100} & \\[0.8em]
 & \vdots & \vdots & \vdots & \ddots & \vdots & \vdots \\[0.8em]
 & 0 & 0 & 0 & \cdots & \frac{1}{100} & \frac{99}{100} \\[0.8em]
 & 0 & 0 & 0 & \cdots & 0 & 1
\end{bmatrix}
"></div>
{% endraw %}

We break this transition matrix into three components: transient-to-transient (Q), transient-to-absorbing (R), and absorbing-to-absorbing (the identify matrix by definition).  The expected number of rolls before being absorbed from each transient state is the following vector:
{% raw %}
<div class="equation" data-expr="t = \left( I - Q \right)^{-1} \mathbf{1}"></div>
{% endraw %}

The expected number of rolls is simply the average of the values in this vector plus 1, since we're equally likely to start at any one of these initial rolls.  A little R code gives us the answer:
``` R
Q <- matrix(0, ncol=100, nrow=100)
Q[upper.tri(Q,diag=TRUE)] <- 1/100
N <- solve(diag(100) - Q)
t <- N %*% matrix(1, nrow=100, ncol=1)
mean(t)+1
```
```
[1] 2.731999
```
