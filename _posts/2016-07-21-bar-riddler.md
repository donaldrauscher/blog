---
published: true
layout: post
title: '538 Riddler: A Variation of the Drunkard''s Walk ... In a Bar'
date: 2015-07-21T00:00:00.000Z
categories: '538, fivethirtyeight, riddler'
tags: '538, fivethirtyeight, riddler, probability'
permalink: /bar-riddler
---
This week’s [Riddler](http://fivethirtyeight.com/features/how-long-will-you-be-stuck-playing-this-bar-game/) is a variation on the well-known OR problem, [the drunkard’s walk](https://en.wikipedia.org/wiki/Random_walk).  We can model this problem as an absorbing Markov Chain with X+Y+1 states.  The transition probability matrix is the following:
{% raw %}
<div class="equation" data-expr="
\begin{matrix}
 & 1 & 0 & 0 & 0 & 0 & \cdots & 0 & \\ 
 & 0.5 & 0 & 0.5 & 0 & 0 & \cdots & 0 & \\ 
 & 0 & 0.5 & 0 & 0.5 & 0 & \cdots & 0 & \\ 
 & 0 & 0 & 0.5 & 0 & 0.5 & \cdots & 0 & \\ 
 & \vdots & \vdots & \vdots & \vdots & \vdots & \ddots & \vdots \\ 
 & 0 & 0 & 0 & 0 & 0 & \cdots & 1
\end{matrix}
"></div>
{% endraw %}

Once we compute the fundamental matrix (N), calculating the expected number of steps until absorption is fairly [easy](https://en.wikipedia.org/wiki/Absorbing_Markov_chain).  Plugging in a few different values of X and Y, a trend emerges: the expected number of coin flips is simply <span style="text-decoration: underline;">X * Y</span>.  Another wonderfully simple Riddler solution!

My R code:
``` R
X <- 4
Y <- 13

# build Q
num_transient_states <- X + Y - 1
Q <- matrix(data = 0, nrow = num_transient_states, ncol = num_transient_states)
for (i in 1:num_transient_states){
  if (i > 1){
    Q[i, i-1] <- 0.5
  }
  Q[i-1, i] <- 0.5
}

# build R
R <- matrix(data = 0, nrow = num_transient_states, ncol = 2)
R[1,1] <- 0.5
R[num_transient_states,2] <- 0.5

# put together into P
P <- rbind(cbind(Q, R), cbind(matrix(0, 2, num_transient_states), diag(2)))

# fundamental matrix
N <- solve(diag(num_transient_states) - Q)

# expected number of steps to absorbtion
t <- N %*% matrix(1, num_transient_states, 1)
print(t[X])

# absorbing probabilities
B <- N %*% R
print(B[X,])
```
