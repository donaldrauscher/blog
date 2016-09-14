---
layout: post
title: '538 Riddler: Who Gets The $100 Bill?'
date: {}
categories: '538, fivethirtyeight, riddler'
tags: '538, fivethirtyeight, riddler, probability'
permalink: /dollar-riddler
published: true
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
Q here represents the transient-to-transient transition matrix (top left 5x5 in above matrix), and R represents the transient-to-absorbing transition matrix (top right 5x5 in the above matrix).  Calculating this out, the probability of winning if the game starts at you, next to you, or two spots away from you is <span class="inline-equation" data-expr="\frac{5}{11} = 45.45\%"></span>, <span class="inline-equation" data-expr="\frac{2}{11} = 18.18\%"></span>, and <span class="inline-equation" data-expr="\frac{1}{11} = 9.09\%"></span> respectively.

``` R

# number of players
n <- 5

# build Q
Q <- matrix(0, n, n)
tri <- lower.tri(matrix(nrow=n,ncol=n))
tri.inner <- cbind(rbind(FALSE, lower.tri(matrix(nrow=n-1,ncol=n-1))), FALSE)
Q[tri] <- 1/3; Q[tri.inner] <- 0; Q[n,1] <- 1/3
Q[upper.tri(Q)] <- t(Q)[upper.tri(Q)]

# build R
R <- matrix(0, n, n)
diag(R) <- 1/3

# calculate fundamental matrix
N <- solve(diag(n) - Q)

# calculate absorbing probabilities
B <- N %*% R
print(B[1,1])

```

The only issue with this approach is that it is tough to derive from it an expression for the general N case, unless you're unusually gifted at finding matrix inverses. A perhaps more intuitive approach is to set up a system of equations.  Because the problem is symmetrical, we need to solve for just 3 variables, the probabilities of winning with the card 0, 1, and 2 people away.  Furthermore, because each turn is independent, we can relate these probabilities to one another as follows:
{% raw %}
<div class="equation" data-expr="\begin{cases}
 & P_{2} = \frac{1}{3} P_{2} + \frac{1}{3} P_{1} \\ 
 & P_{1} = \frac{1}{3} P_{2} + \frac{1}{3} P_{0} \\ 
 & P_{0} + 2 P_{1} + 2 P_{2} = 1 \\
\end{cases}"></div>
{% endraw %}

Solving this system is straightforward and yeilds the same solution as above.  We can also easily extend it for the N=6 case:
{% raw %}
<div class="equation" data-expr="\begin{cases}
 & P_{3} = \frac{2}{3} P_{2} \\ 
 & P_{2} = \frac{1}{3} P_{3} + \frac{1}{3} P_{2} \\ 
 & P_{1} = \frac{1}{3} P_{2} + \frac{1}{3} P_{0} \\ 
 & P_{0} + 2 P_{1} + 2 P_{2} + P_{3} = 1 \\
\end{cases}"></div>
{% endraw %}

After solving a few of these, I got the following trend:
