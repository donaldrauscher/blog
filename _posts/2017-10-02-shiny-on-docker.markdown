---
layout: post
title: 'How to Deploy a Shiny App on Google Container Engine'
date:   2017-10-02
tags: [gcp, docker, containers, shiny, farkle]
permalink: /shiny-on-docker
resources: [katex]
---

[Shiny](https://shiny.rstudio.com/) is an awesome tool for building interactive apps powered by R. There are a couple options for [deploying](https://shiny.rstudio.com/deploy/) Shiny apps.  You can deploy to [Shinyapps.io](http://www.shinyapps.io/).  You can also deploy on your own machine using open source Shiny Server.  This tutorial shows how to setup a Docker container for a Shiny App and deploy on Google Container Engine using Kubernetes.  And because deploying the "Hello World" example is entirely unsatisfying, I chose to build an app to help guide strategy for a game I recently played.

## Farkle - A Game of <span style='text-decoration:line-through;'>Guts & Luck</span> Probability

My wife and I recently stumbled upon this game in one of our relative's game closets.  The game is very simple and is played with just 6 dice (how they get people to buy a game that is comprised of only 6 dice is beyond me).  Different rolls are worth different amounts of points. 4 of a kind is worth 1000 points, 1-2-3-4-5-6 is worth 1500 points, three 6s is worth 600 points, etc.  1s and 5s _not_ used in other combinations count as 100 and 50 points respectively.  Detailed scoring rules [here](http://www.smartboxdesign.com/farklerules.html). For instance, a roll of 1-3-3-4-5-3 = 300 + 100 + 50 = 450 points.  

Any dice that don't count towards your score can be rolled again.  However, and this is the catch, if you score no points on a roll, you lose all points accumulated up to that point.  So in the above example, we could choose to roll 1 die (from the non-scoring 4), but we will lose the 450 points that we've banked if we don't roll a 1 or a 5 (the only scoring options with a single die).

If you manage to use score using all 6 of the dice, you get to start rolling again with all 6 dice. A short-sighted player may observe that <span class="inline-equation" data-expr="\frac{2}{3}*0+\frac{1}{6}*500+\frac{1}{6}*550 = 175 < 450"></span> and thus not be willing to risk rolling that last die.  However, those 500 and 550 scenarios are too low!  The average 6 dice roll results in 0 points just 2.3% of the time and an average of 397.7 points if not zero.  Incorporating this into our expectation, the average number of points on the next two rolls is:
<div class="equation" data-expr="\left(\frac{2}{3} + \frac{1}{3}*0.023\right)*0+\frac{1}{6}*(1 - 0.023)(500+397.7)+\frac{1}{6}*(1 - 0.023)*(550+397.7) = 300.5"></div>

And this is still conservative.  You have the option to roll a third time after that second roll, when prudent, which will increase the expected number of points further.  Though it still doesn't make sense to roll that last die, it's much closer than it appeared at face value.

## Building & Deploying Our Shiny App

I started by doing a little up-front work to generate the state space of possible rolls.  This computation is not reactive and only needs to be performed once at app start-up.  Next, I created a recursive `play` function which determines the optional strategy (roll or stop) with parameters for how many points have been banked so far and how many dice are remaining.  I gave the function a max recursion depth to limit computation time.  I figured this is okay since (1) turns with a large number of rolls are quite improbable and thus contribute less to our decision making and (2) players become increasingly less likely to continue rolling as they accumulate more points since they have more to lose.  Finally, I made the Shiny app. Building Shiny apps involves laying out inputs, outputs, and the logic that ties them together.  This app is very simple.  Just 26 lines of R!

On GCP, one option for deploying our Shiny app is spinning up a Compute Instance, installing all the necessary software (R, Shiny server, and other necessary R packages), and downloading the code for our app.  An easier option is to instead use a container like Docker. Fundamentally, containers allow developers to separate applications from the environments in which they run.  Containers package an application and its dependencies into a single manifest (that can be version controlled) that runs directly on top of an OS kernel.

Firstly, we need to setup a [Dockerfile](https://docs.docker.com/engine/userguide/eng-image/dockerfile_best-practices/) for our Docker image.  Since we can easily [leverage other images](https://docs.docker.com/engine/reference/builder/#from) shared on the Docker hub, this is very easy!
``` bash
FROM rocker/shiny
RUN R -e "install.packages(c('dplyr'), repos='http://cran.rstudio.com/')"
COPY ./shiny/ /srv/shiny-server/farkle/
```
Note: I'm extending [this image](https://hub.docker.com/r/rocker/shiny/) on Docker hub which sets up Shiny server.  After that, I just install the dplyr package and copy my app to the /srv/shiny-server directory.  So easy!

Next, we're going to run a few commands to make our Docker image and verify that it works:
``` bash
docker build -t farkle:latest .
docker images ls
docker run --rm -p 3838:3838 farkle:latest # for testing locally
```

Finally, we're going to deploy this image to Google Container Engine.  Google has a great tutorial [here](https://cloud.google.com/container-engine/docs/tutorials/hello-app) on how to do this.  In short, we're going to upload our Docker image to Google Container Registry, create a container cluster running Kubernetes, deploy our image to this cluster, and make our application externally accessible using a Service.  I also created an static IP for my cluster which I hooked up to my domain using an A Record.

``` bash
export PROJECT_ID=$(gcloud config get-value project -q)
docker tag farkle gcr.io/${PROJECT_ID}/shiny-farkle:latest
gcloud docker -- push gcr.io/${PROJECT_ID}/shiny-farkle:latest
gcloud container clusters create shiny-farkle --num-nodes=3
kubectl run shiny-farkle --image=gcr.io/${PROJECT_ID}/shiny-farkle:latest --port 3838
gcloud compute addresses create shiny-farkle-ip --region us-central1
export SHINY_IP=$(gcloud compute addresses describe shiny-ip --region us-central1 --format json | python -c "import sys,json; print(json.load(sys.stdin)['address'])")
kubectl expose deployment shiny-farkle --type=LoadBalancer --port 80 --target-port 3838 --load-balancer-ip=${SHINY_IP}
kubectl get service
```

That final command will return the external IP for our Service.  Simply go to http://${IP_ADDR}/farkle to verify that its working.

## Some Farkle Insights

Here is a summary of the expected number of points and the probability of scoring zero points on a single roll:
<table class="pretty">
<tr><th>Dice Remaining</th><th>P(Points = 0)</th><th>E[Points]</th></tr>
<tr><td>1</td><td>66.7%</td><td>25.0</td></tr>
<tr><td>2</td><td>44.4%</td><td>50.0</td></tr>
<tr><td>3</td><td>27.8%</td><td>83.6</td></tr>
<tr><td>4</td><td>15.7%</td><td>132.7</td></tr>
<tr><td>5</td><td>7.7%</td><td>203.3</td></tr>
<tr><td>6</td><td>2.3%</td><td>388.5</td></tr>
</table>

As expected, the more dice we roll, the more likely we are to _not_ get zero points.  Furthermore, since more high scoring options are available with each die, each incremental die gives us more expected points than the last.

But the really important question is this: if I have X dice remaining, how many points must I have in the bank to NOT roll?  Using our Shiny app (3 roll look-forward), I estimated these numbers:
<table class="pretty">
<tr><th>Dice Remaining</th><th>Bank Threshold to Stop Rolling</th></tr>
<tr><td>1</td><td>262</td></tr>
<tr><td>2</td><td>225</td></tr>
<tr><td>3</td><td>386</td></tr>
<tr><td>4</td><td>944</td></tr>
<tr><td>5</td><td>2,766</td></tr>
<tr><td>6</td><td>16,785</td></tr>
</table>

The game is played to 10,000 points (with the lagging player getting a rebuttal opportunity). So there is virtually no scenario in which you would not roll 6 dice when given the opportunity!  You can find a link to all of my work [here](https://github.com/donaldrauscher/shiny-farkle) and a link to the app deployed using this methodology [here](http://shiny.donaldrauscher.com/farkle/)  Cheers!

Note #1: A big simplification that I make on game play is that _all dice that can be scored will be scored_.  In reality, players have the option not to score all dice.  For instance, if I roll three 1s, I can choose to bank one 1 and roll the 5 remaining dice, which, using our app, makes sense.  100 in the bank and 5 remaining dice has a 352.0 expectation; 200 in the bank and 4 dice remaining has a 329.0 expectation.

Note #2: Of course, these estimates are agnostic to the game situation.  In reality, you're trying to maximize your probability of winning, not your expected number of points.  If you are down by 5000 points, you're going to need to be a lot more aggressive.
