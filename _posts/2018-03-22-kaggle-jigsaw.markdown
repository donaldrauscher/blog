---
layout: post
title: 'Sklearn + Dask + K8s for the Toxic Comment Classification Challenge'
date:   2018-03-22
tags: [kaggle, nlp, gke, dask, sklearn]
permalink: /kaggle-jigsaw
---

The goal of [this Kaggle challenge](https://www.kaggle.com/c/jigsaw-toxic-comment-classification-challenge) was to build a model to flag toxic Wikipedia comments.  The training dataset included 159,571 Wikipedia comments which were labeled by human raters.  Each comment was evaluated on 6 dimensions: toxic, severe toxic, obscene, threat, insult, and identity hate.

## Model & Hyperparameter Tuning

My model was fairly straightforward: TF-IDF + K-Best + LR.  

``` python
pipeline = Pipeline(steps = [
    ('cv', CountVectorizer(min_df=5, max_features = 50000, lowercase=False, strip_accents='unicode', stop_words='english', analyzer='word')),
    ('tfidf', TfidfTransformer(sublinear_tf = True, use_idf = True)),
    ('kbest', SelectKBest()),
    ('model', LogisticRegression(class_weight = "balanced"))
])
```

I used [Dask.distributed](https://distributed.readthedocs.io/en/latest/), specifically the [`dask-searchcv`](http://dask-searchcv.readthedocs.io/en/latest/) package, to parallelize my hyperparameter tuning step.  One of the big advantages of the `dask-searchcv` implementations of GridSearchCV and RandomizedSearchCV is that they avoid repeated work. Estimators with identical parameters and inputs will only be fit once!  In my example, I tested the following grid:
``` python
param_grid = {
    'cv__ngram_range': [(1, 1), (1, 2)],
    'tfidf__norm': ['l1', 'l2', None],
    'kbest__k': [10000, 25000, "all"],
    'model__C': [0.01, 0.1],
    'model__penalty': ['l1', 'l2']
}
```

Even though this parameter grid has 72 different combinations, GridSearchCV will only run the CountVectorizer step 2 times, the TFIDF step 6 times, etc. Much more efficient! Since I used 3-fold cross validation, I tuned 216 models for each Y variable, 1,296 models in total.

Here's a snapshot of the Dask web UI during hyper parameter tuning:
<img src="/assets/img/dash-web-ui.png" width="885px" style="display:block; margin-left:auto; margin-right:auto;">

## Dask Cluster

I set up my Dask cluster using Kubernetes.  And, of course, there was a very useful [Helm chart](https://github.com/kubernetes/charts/tree/master/stable/dask) for this already.  This Helm chart sets up a Dask scheduler + web UI, Dask worker(s), and a Jupyter Notebook instance.  When installing the Helm chart, you can use an accompanying `values.yaml` file to specify which Python packages you need to install.  I also used Terraform to create / scale my K8s cluster.

I set up [three scripts](https://github.com/donaldrauscher/kaggle-jigsaw/tree/master/scripts) for initializing cluster, scaling up the number of nodes / workers, and destroying the cluster when we're done.

Note: The `helm init --wait` command will wait until the Tiller is running and ready to receive requests.  Very useful for CI/CD workflows.  You will need to be running [v2.8.2](https://github.com/kubernetes/helm/releases/tag/v2.8.2) (most recent as of the time of this post) to use this.  

## Results

<table class="pretty">
<tr><th>toxic</th><th>severe_toxic</th><th>obscene</th><th>threat</th><th>insult</th><th>identity_hate</th><th>total</th></tr>
<tr><td>0.96186</td><td>0.98513</td><td>0.97770</td><td>0.98091</td><td>0.97065</td><td>0.97321</td><td>0.97491</td></tr>
</table>

Pretty good!  With more time, I definitely would have experimented with other model formulations and a blend of multiple models.  A [link](https://github.com/donaldrauscher/kaggle-jigsaw) to my repo on GH.
