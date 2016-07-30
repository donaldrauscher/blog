---
published: false
layout: post
date: 2016-07-30T00:00:00.000Z
categories: '538, fivethirtyeight, riddler'
tags: '538, fivethirtyeight, riddler, logic'
permalink: /traitorous-generals
---

Let's start by picking one general at random.  We can determine this specific general's loyalty by polling the other generals.  As we go around the circle, there are two stop conditions:
1. The selected general receives <span class="inline-equation" data-expr="\left( \lceil N/2 \rceil \right)-1"></span> loyal votes
2. The selected general receives <span class="inline-equation" data-expr="\left( \lceil N/2 \rceil \right)"></span> traitorous votes
If [1] happens, we know the selected general to be loyal.  If [2] happens, we know the selected general to be traitorous.  This works because we know that there is a majority of loyal generals and that all loyal generals are honest 100% of the time.  If, during this inquisition, we identify a traitorous general, then we incarcerate him (or perhaps a more sinister punishment) and pick a new general to evaluate.  Through this process, we are guaranteed to find a loyal general. How many questions will it take though? 

How far around the circle we go is a function of how the traitors choose to behave.  This requires a little explanation.  Let's say we pick a traitorous general for our first inquisition.  All the other traitors shouldn't try to vouch for him because (1) it will not save him and (2) it will doom them individually.  We're going to get to the right answer one way or the other, and anyone who said the traitor was not a traitor will be outed along with him.  If our traitors choose the "band together" route, this whole thing will be over in a max of <span class="inline-equation" data-expr="2 \left( \lceil N/2 \rceil - 1 \right)"></span> votes (depending on who we ask first), and there will be no need for any subsequent rounds since we'll know exactly who is a traitor and who is loyal.  If our traitors are self-preservational, this round will be over in exactly <span class="inline-equation" data-expr="\left( \lceil N/2 \rceil \right)-1"></span> questions. 

Why might we assume that traitors are self-preservational?  Depends on whether the generals know what the emperor is trying to accomplish here.  If the generals know the emperor is trying to identify a single loyal general for a super-important mission, then it makes sense for them to be self-preservational.  If the generals think the emperor is going to methodically proceed through the ranks until he has killed every last traitor...well then I guess the traitors will be somewhat ambivalent, given that they're all going to die either way.  Let's assume the generals don't know what the emperor is going to do.  And since there is a non-zero probability that the emperor is just trying to find a single loyal general, I think it's fair to assume that the traitorous generals will behave in a self-preservational way.  Plus, this scenario represents the upperbound, since it extends the process and makes it more difficult to weed out traitors.

Assuming the worst case scenario where we keep picking traitorous generals, each subsequent inquisition distills our pool of generals to a smaller, more loyal group, making it easier and easier to assess the loyalty of our selected general.  We need, at most, <span class="inline-equation" data-expr="\left( \lceil N/2 \rceil \right)-1"></span> rounds of inquisitions; if we pick traitors in all of those, then we know any one of the remaining generals is loyal.

Putting this all together, the maximum number of questions we would need is:
{% raw %}
<div class="equation" data-expr="\sum_{i=1}^{\left( \lceil N/2 \rceil \right)-1} \left( i-1 \right ) = \left( \sum_{i=1}^{\lceil N/2 \rceil} i \right) - 1 = \frac{\lceil N/2 \rceil \left( \lceil N/2 \rceil +1 \right )}{2} - 1"></div>
{% endraw %}

Final answer.