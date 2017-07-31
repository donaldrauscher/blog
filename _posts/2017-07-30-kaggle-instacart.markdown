---
layout: post
title: '10B Grocery Recommendations on Google Dataproc for the Kaggle Instacart Challenge'
date:   2017-07-30
tags: [collaborative_filtering, pyspark, dataproc, gcp, kaggle]
permalink: /kaggle-instacart
---

I was intrigued by [this competition](https://www.kaggle.com/c/instacart-market-basket-analysis) because it was very challenging and outside my comfort zone.  We're not just trying to predict whether someone will buy a specific product; we're trying to predict the *entirety* of someone's next order!  And there are 49,688 possible products.  All the solutions that I found in public notebooks were simply trying to predict which products would be reordered, among those that had been ordered previously.  However, in the train orders, 60% of the products being ordered are reorders and 40% of the products are being ordered for the first time.  So this approach is only addressing 60% of the problem!

For this challenge, I built two models: (1) one model to predict which products would be reordered and (2) one model to predict new product trial.  This post will focus on the latter, predicting new product trial.  For this, I decided to use Spark.  Specifically PySpark on Google Dataproc.  My first foray into the world of Spark!

## The Spark Job

I used collaborative filtering to make product recommendations for each user. I used order frequency (percent of orders containing that product) as the feedback and modeled it as implicit (rather than explicit).  And I used regularization to prevent overfitting, though admittedly didn't spend much time tuning this or the number of latent factors / number of iterations.  

The full user-product crossproduct is ~10B combinations!  The challenge was generating all of these predictions and keeping the top ones:

1. Generating universe of possible combinations - Creating the full cartesian cross product is easy enough; Spark has a nice [built-in function](https://spark.apache.org/docs/latest/api/python/pyspark.html#pyspark.RDD.cartesian) for this.  The challenge here was removing existing user-product combinations.  To do this efficiently, I made a dictionary containing user-product combinations and saved it in each worker as a broadcast variable.  This sped things up a lot.  You also need to be careful with partitioning.  The cartesian of X with A partitions and Y with B partitions returns [X*Y with A*B partitions](https://techmagie.wordpress.com/2015/12/19/understanding-spark-partitioning/).  I ran a coalesce after performing this partition to slim down the number of partitions.

2. Selecting the top predictions for each user - Alas, Spark does not have a takeOrderedByKey function!  However, we can make one and add it to the RDD class, being careful to [use combineByKey instead of groupByKey](https://databricks.gitbooks.io/databricks-spark-knowledge-base/content/best_practices/prefer_reducebykey_over_groupbykey.html).  I also used Python's built-in [heap queue algorithm](https://docs.python.org/2/library/heapq.html) to maintain the top N records at any given time on both the mapper and the reducer side.  Very memory efficient.

``` python
from __future__ import print_function
from pyspark.rdd import RDD
from pyspark import SparkContext, SparkConf
from pyspark.mllib.recommendation import ALS, MatrixFactorizationModel, Rating
from subprocess import call
import math, csv, heapq, sys

conf = SparkConf().setAppName("cf_model")
sc = SparkContext(conf=conf)
sc.setCheckpointDir('checkpoint/') # checkpointing helps prevent stack overflow errors

# pull in data
num_partitions = int(sys.argv[1])
data_dir = sys.argv[2]
data_dir = data_dir + '/' if data_dir[-1] != '/' else ''
cf_up_matrix = sc.textFile(data_dir + "cf_up_matrix.csv", num_partitions)

# extract header
header = cf_up_matrix.first() #extract header
cf_up_matrix = cf_up_matrix.filter(lambda row: row != header)
cf_up_matrix = cf_up_matrix.map(lambda l: l.split(','))
cf_up_matrix = cf_up_matrix.map(lambda x: (int(x[0]), int(x[1]), float(x[2])))

# extract ratings
cf_up_matrix_ratings = cf_up_matrix.map(lambda l: Rating(l[0], l[1], l[2]))

# recommendations
print("Training model...")
params = {'rank' : 20, 'iterations' : 20, 'alpha' : 0.01, 'lambda_' : 0.01}
model = ALS.trainImplicit(cf_up_matrix_ratings, **params)

# create a full of user/product combos
print("Making all user-product combinations...")
users = cf_up_matrix.map(lambda x: x[0]).distinct()
products = cf_up_matrix.map(lambda x: x[1]).distinct().cache()
print(products.take(5)) # saves on every node
up_combo_full = users.cartesian(products).coalesce(num_partitions)

# filter out existing combos
print("Filtering out existing combos...")
up_combo_existing = sc.broadcast(cf_up_matrix.map(lambda x: (x[0], [x[1]])).reduceByKey(lambda a,b: a + b).collectAsMap())
up_combo_potential = up_combo_full.filter(lambda x: x[1] not in up_combo_existing.value.get(x[0]))

# generate predictions
print("Generating predictions...")
up_rec = model.predictAll(up_combo_potential)

# take top 100 for each user; use custom 'ByKey' RDD function
def takeOrderedByKey(self, num, sortKey = None):

    def init(a):
        a = [(sortKey(a), a)]
        heapq.heapify(a)
        return a

    def combine(agg, a):
        heapq.heappush(agg, a if type(a) == tuple else (sortKey(a), a))
        if len(agg) > num:
            heapq.heappop(agg)
        return agg

    def merge(agg1, agg2):
        for i in agg2:
            agg1 = combine(agg1, i)
        return agg1

    return self.combineByKey(init, combine, merge)

RDD.takeOrderedByKey = takeOrderedByKey

print("Isolating top 100 products for each user...")
up_rec_top = up_rec.map(lambda x: (x[0], x)).takeOrderedByKey(100, sortKey = lambda x: x[2])
up_rec_top = up_rec_top.flatMapValues(lambda x: x).map(lambda x: x[1][1])

# save
print("Exporting...")
export = 'cf_up_rec_top.csv'
with open(export, 'wb') as csvfile:
    csvwriter = csv.writer(csvfile, delimiter=',')
    csvwriter.writerow(['user_id', 'product_id', 'order_freq'])
    rows = up_rec_top.collect()
    for row in rows:
        csvwriter.writerow(row)
call(["gsutil", "rm", data_dir + export])
call(["gsutil", "cp", export, data_dir + export])
```

## Configuring the Cluster

The cluster on which I ran this job contained 5 n1-standard-4 workers, 3 of which were [preemptible](https://cloud.google.com/dataproc/docs/concepts/preemptible-vms).  When monitoring jobs, I noticed that YARN was not using all of the available cores.  This seemed to be because the [default resource calculator](https://stackoverflow.com/questions/25563736/yarn-is-not-honouring-yarn-nodemanager-resource-cpu-vcores/25570709#25570709) was using memory only; changing this to the dominant resource calculator in the [cluster properties](https://cloud.google.com/dataproc/docs/concepts/cluster-properties) fixed the problem.  Determining the right number of partitions was a bit of a trial-and-error process.  Too many partitions caused the job to waste time scheduling; too few partitions caused out-of-memory errors.  Spark [recommends](https://spark.apache.org/docs/latest/tuning.html) 2-3 times as many partitions as the number of cores in your cluster.

## Production Environment

Finally, because I like knowing how things might work in a production environment, I wrote a [script](https://github.com/donaldrauscher/kaggle-instacart/blob/master/run_cf_model.py) to execute this entire process end-to-end: uploading the PySpark script to GCS, creating the cluster, kicking off the job and waiting for it to complete, downloading the job output, and destroying the cluster once complete.  For this I used the [Google Cloud Client](https://googlecloudplatform.github.io/google-cloud-python/stable/) and [Dataproc](https://cloud.google.com/dataproc/docs/reference/rest/) APIs.  

====

Overall, I really enjoyed working with Spark.  It forced me to think more carefully about code efficiency and memory usage.  I'm excited to work more with Spark's MLlib and SQL packages.  You can find all of my code for this project [here](https://github.com/donaldrauscher/kaggle-instacart).  Cheers!
