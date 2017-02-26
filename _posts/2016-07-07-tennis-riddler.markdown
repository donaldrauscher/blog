---
layout: post
title:  "538 Riddler: Defeating Roger Federer"
date:   2016-07-07
tags: [538, fivethirtyeight, riddler, probability]
permalink: /tennis-riddler
---

I began [this challenge](http://fivethirtyeight.com/features/can-you-figure-out-how-to-beat-roger-federer-at-wimbledon/) at the obvious starting point: I win my first 71 points against Roger.  This puts me up 2 sets to 0, up 5-Nill in the 3rd, and winning 40-Love in what is possibly the final game of the match.  Things look pretty good; I've got a triple match point.  However, Roger's greatness cannot be underestimated, even in his twilight years.  In my Monte Carlo simulation, I win just 287 of 10K games starting here (2.87%).  All of my victories come from clinching that 6th game in the 3rd set.  If I lose that game, I'm toast.  With a 1% probability of winning each point, there's virtually no chance that I claw my way back.

If we focus exclusively on that final game, there is a scenario which gives us a few more opportunities to win.  We can begin the match up 2 sets to 0 and up 6-0 in the tie break in the 3rd (tie breaks are allowed in all sets except the 5th at Wimbledon).  This gives us 6 match points!  The probability that we win this tie break is:

{% raw %}
<div class="equation" data-expr="P\left( W \right) = p + pq + pq^2 + pq^3 + pq^4 + pq^5 + q^6 \left( p^2 + \left( 2pq \right)p^2 + \left( 2pq \right)^2 p^2 + ... \right)"></div>
<div class="equation" data-expr="= p + pq + pq^2 + pq^3 + pq^4 + pq^5 + q^6 \frac{p^2}{\left( 1 - 2pq \right)} = 5.86\%"></div>
{% endraw %}

<img src="/assets/img/tennis-riddler.jpeg" style="display:block; margin-left:auto; margin-right:auto;">

When the probability of winning each point hits 11%, we are more likely to prevail in the tie break than Roger!  Code is posted to my Github [here](https://github.com/donaldrauscher/tennis-riddler).  Cheers.
