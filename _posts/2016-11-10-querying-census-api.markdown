---
layout: post
title:  "Using the US Census API"
date:   2016-11-10
categories: api, census, data-scraping
tags: api, census, data-scraping
permalink: /census-api
---

The other day I was building a model and wanted to layer in some ZIP-level census data. Some quick Googling led me to [this .gov site](...) where you can search a database of stock reports and data cuts.  However, I wasn't able to find what I was looking for.  Not sure if I was searching ineffectively (the interface is a little clunky) or my somewhat-specific request didn't align with any of the stock reports.

I had resigned myself to downloading one of the big databases with all the census data (overkill) until I stumbled upon a [post](...) from the data folks at Splitwise (if you're not already a user, I highly recommend) which cued me into the US Census API.  An API!  Not what I was expecting from a government agency, but I'll take it.

Some useful links:
* You can apply for an API key [here](...)
* Here's a [link](...) to the official documentation
* A [list](...) of the geographies at which cut the data
* And a [list](...) of the variables that you can pull

One thing I did quickly realize: you can't pull the entire ZIP universe in a single API pull.  Not totally surprising.  There are, after all, ~40K ZIP codes.  You need to pull ZIP-code information by state.  Download a list of states, then loop through the states and download ZIP-level information for each one (adding `&in=state:XX` into each call).  The [list of geographies](...) details what info you need to provide to download data at different levels of granularity.  For instance, if you wanted to pull even more granular county-level information, you would need to specify both X and Y.

I posted a code snippet which pulls population by ZIP code on my GH [here](...).  Cheers!
