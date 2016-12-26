---
layout: post
title:  "Using the US Census API"
date:   2016-11-10
categories: api, census, data-scraping
tags: api, census, data-scraping
permalink: /census-api
---

The other day I was building a model and wanted to layer in some ZIP-level census data. Some quick Googling led me to [this .gov site](http://factfinder.census.gov/faces/nav/jsf/pages/index.xhtml) where you can search a database of stock reports and data cuts.  However, I wasn't able to find what I was looking for.  Not sure if I was searching ineffectively (the interface is a little clunky) or my somewhat-specific request didn't align with any of the stock reports.

I had resigned myself to downloading one of the big databases with all the census data (overkill) until I stumbled upon a [post](https://blog.splitwise.com/2013/09/18/the-2010-us-census-population-by-zip-code-totally-free/) from the data folks at Splitwise (if you're not already a user, I highly recommend) which cued me into the US Census API.  An API!  Not what I was expecting from a government agency, but I'll take it.

+ You can apply for an API key [here](http://api.census.gov/data/key_signup.html)
+ Here's a [link](http://www.census.gov/data/developers/data-sets/decennial-census.html) to the official documentation
+ A [list](http://api.census.gov/data/2010/sf1/geography.html) of the geographies at which cut the data
+ And a [list](http://api.census.gov/data/2010/sf1/variables.html) of the variables that you can pull

One thing I did quickly realize: you can't pull the entire ZIP universe in a single call.  Not totally surprising.  There are, after all, ~40K ZIP codes.  You need to pull ZIP-code information by state.  Download a list of states, then loop through the states and download ZIP-level information for each one  (adding `&in=state:XX` into each call).  The [list of geographies](http://api.census.gov/data/2010/sf1/geography.html) details what info you need to provide to download data at different levels of granularity.  For instance, if you wanted to pull data at the uber-granular block level, you would need to specify a specific state, county, and tract.

I posted a code snippet which pulls population by ZIP code on my GH [here](https://github.com/donaldrauscher/census-api).  Cheers!
