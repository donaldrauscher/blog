---
layout: post
title: '538 Riddler: Who Gets The $100 Bill?'
date:   2016-09-11
categories: 538, fivethirtyeight, riddler
tags: '538, fivethirtyeight, riddler, probability'
permalink: /dollar-riddler
---

I modelled this week's [Riddler](http://fivethirtyeight.com/features/who-keeps-the-money-you-found-on-the-floor/) as an [absorbing Markov chain](https://en.wikipedia.org/wiki/Absorbing_Markov_chain).  This MC has 5 transient states (representing the dollar bill sitting in front of someone) and 5 absorbing states (which represent someone winning).  The transition probability matrix is the following:
{% raw %}
<div class="equation" data-expr="
\begin{matrix}
 & 0 & \frac{1}{3} & 0 & 0 & \frac{1}{3} & \frac{1}{3} & 0 & 0 & 0 & 0 \\
 & \frac{1}{3} & 0 & \frac{1}{3} & 0 & 0 & 0 & \frac{1}{3} & 0 & 0 & 0 \\
 & 0 & \frac{1}{3} & 0 & \frac{1}{3} & 0 & 0 & 0 & \frac{1}{3} & 0 & 0 \\ 
 & 0 & 0 & \frac{1}{3} & 0 & \frac{1}{3} & 0 & 0 & 0 & \frac{1}{3} & 0 \\ 
 & \frac{1}{3} & 0 & 0 & \frac{1}{3} & 0 & 0 & 0 & 0 & 0 & \frac{1}{3} \\ 
 & 0 & 0 & 0 & 0 & 0 & 1 & 0 & 0 & 0 & 0 \\
 & 0 & 0 & 0 & 0 & 0 & 0 & 1 & 0 & 0 & 0 \\
 & 0 & 0 & 0 & 0 & 0 & 0 & 0 & 1 & 0 & 0 \\ 
 & 0 & 0 & 0 & 0 & 0 & 0 & 0 & 0 & 1 & 0 \\ 
 & 0 & 0 & 0 & 0 & 0 & 0 & 0 & 0 & 0 & 1 \\ 
\end{matrix}
"></div>
{% endraw %}

From this transition matrix we can calculate the absorbing probabilities using the following formula:
{% raw %}
<div class="equation" data-expr="B = \left( I - Q \right)^{-1} * R"></div>
{% endraw %}
Q here represents the transient-to-transient transition matrix (top left 5x5 in above matrix), and R represents the transient-to-absorbing transition matrix (top right 5x5 in the above matrix).  Calculating this out, the probability of winning if the game starts with you is <span class="equation" data-expr="\frac{5}{11} = 45.45\%"></span>.  The probability of winning if the bill starts next to you is <span class="equation" data-expr="\frac{2}{11} = 18.18\%"></span>.  Finally, the probability of winning if the bill starts opposite you (2 people away) is just <span class="equation" data-expr="\frac{1}{11} = 9.09\%"></span>.

``` R

# build Q
Q <- matrix(0, 5, 5)
tri <- lower.tri(matrix(nrow=5,ncol=5))
tri.inner <- cbind(rbind(FALSE, lower.tri(matrix(nrow=4,ncol=4))), FALSE)
Q[tri] <- 1/3; Q[tri.inner] <- 0; Q[5,1] <- 1/3
Q[upper.tri(Q)] <- t(Q)[upper.tri(Q)]

# build R
R <- matrix(0, 5, 5)
diag(R) <- 1/3

# calculate fundamental matrix
N <- solve(diag(5) - Q)

# calculate absorbing probabilities
B <- N %*% R
print(B)

```
