---
layout: post
title: 'Model Stacking using Sklearn''s VotingClassifier'
date:   2017-12-10
tags: [python, sklearn, machine_learning, model_stacking]
permalink: /sklearn-stack
---

[Stacking](https://rd.springer.com/content/pdf/10.1007%2FBF00117832.pdf), also called meta ensembling, is a technique used to boost predictive accuracy by blending the predictions of multiple models.  This technique is most effective when you have multiple, well-performing models which are _not_ overly similar.  Participants in Kaggle competitions will observe that winning solutions are often blends of multiple models, sometimes even models available in public notebooks!  A [nice write-up](https://mlwave.com/kaggle-ensembling-guide/) from Kaggle grand master [Triskelion](https://www.kaggle.com/triskelion) on using stacking in Kaggle competitions.  Throw back: the winning solution to the NetFlix challenge, from team BellKor's Pragmatic Chaos, used [a blend of hundreds of different models](https://www.netflixprize.com/assets/GrandPrize2009_BPC_BigChaos.pdf).

<img src="/assets/img/stacking.png" style="display:block; margin-left:auto; margin-right:auto;">
Source: [https://rasbt.github.io/mlxtend/user_guide/classifier/StackingClassifier/](https://rasbt.github.io/mlxtend/user_guide/classifier/StackingClassifier/)

I recently sought to implement a simple model stack in sklearn.  The mlxtend package has a [`StackingClassifier`](https://rasbt.github.io/mlxtend/user_guide/classifier/StackingClassifier/) for this.  However, I chose to use a native sklearn class, [`VotingClassifier`](http://scikit-learn.org/stable/modules/generated/sklearn.ensemble.VotingClassifier.html), for my stack.  The only problem with this class is that voting weights must be specified manually!  So I created a simple wrapper to tune the weights in my `VotingClassifier`.  

I used ["stars and bars"](https://en.wikipedia.org/wiki/Stars_and_bars_(combinatorics)) to create a list of weight combinations to test.  I used `cross_val_predict` to generate out-of-sample predictions for each model in the stack.  This is really important!  Otherwise overfitting models will dominate the weights.  Finally, to evaluate performance, I made a dummy estimator (`ScoreEstPassThru`) to pass predictions to a user-specified scorer; this allowed me to compute predictions from my estimators only once while also leveraging all the logic baked into sklearn's base scorers.  

``` python
import numpy as np

from sklearn.ensemble import VotingClassifier as BaseVotingClassifier
from sklearn.utils.metaestimators import _BaseComposition
from sklearn.base import ClassifierMixin, TransformerMixin
from sklearn.metrics.scorer import check_scoring, _PredictScorer
from sklearn.utils.validation import check_is_fitted
from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import cross_val_predict

# passes pre-computed outputs to scorer
class ScoreEstPassThru(object):

    def __init__(self, y_label_encoder):
        self.y_label_encoder = y_label_encoder

    def predict(self, X):
        check_is_fitted(self.y_label_encoder)
        maj = np.argmax(X, axis = 1)
        maj = self.y_label_encoder.inverse_transform(maj)
        return maj

    def predict_proba(self, X):
        return X

# base voting classifier with some extra method(s)
class VotingClassifier(BaseVotingClassifier):

    # first dimension must be samples for `cross_val_predict`
    def _collect_probas_flatten(self, X):
        return np.concatenate(self._collect_probas(X), axis = 1)

# voting classifier which determines optimal weights
class VotingClassifierWeightTune(_BaseComposition, ClassifierMixin, TransformerMixin):

    def __init__(self, estimators, scoring, weights_granularity = 10, weights_cv = 3, voting = 'soft', n_jobs = 1, flatten_transform = None):
        self.voter = VotingClassifier(estimators = estimators, voting = voting, n_jobs = n_jobs, flatten_transform = flatten_transform)
        self.scorer = check_scoring(self.voter, scoring = scoring)
        self.voting = voting
        self.weights_granularity = weights_granularity
        self.weights_cv = weights_cv
        self.weights_ = None

        if voting == 'hard' and self.scorer.__class__ != _PredictScorer:
            raise Exception("When voting = 'hard', must use scorer that doesn't need a threshold or probability input (e.g. accuracy)")

    @property
    def weights(self):
        return self.weights_

    @weights.setter
    def weights(self, w):
        self.voter.weights = w
        self.weights_ = w

    def fit(self, X, y, sample_weight = None):
        # create universe of weights to test
        n_est = len(self.voter.estimators)
        weights = [[j/(self.weights_granularity * 1.0) for j in i] for i in stars_and_bars(n_est, self.weights_granularity)]

        # compute predictions from each model once for efficiency
        # NOTE: chose to make VotingClassifier an object within VotingClassifierWeightTune
        # rather than extension b/c o.w. `cross_val_predict` would create a recursion
        func = '_collect_probas_flatten' if self.voting == 'soft' else '_predict'
        est_pred = cross_val_predict(self.voter, X, y, cv = self.weights_cv, method = func)

        # score with different weights
        # NOTE: not using `scorer` conventionally because not passing it an estimator
        y_le = LabelEncoder().fit(y)
        sept = ScoreEstPassThru(y_le)
        scores = []
        for w in weights:
            if self.voting == 'soft':
                pseudo_X = np.average(
                    np.split(est_pred, n_est, axis = 1),
                    axis = 0, weights = w)
            else:
                pseudo_X = np.apply_along_axis(
                    lambda x: np.bincount(x, weights = w, minlength = len(y_le.classes_)),
                    axis = 1, arr = est_pred)
            score = self.scorer(sept, pseudo_X, y)
            scores.append(score)

        # determine optimal weight
        optimal_weights = weights[np.argmax(scores)]
        self.weights = optimal_weights

        # tune the estimators on full data
        self.voter.fit(X, y, sample_weight)

    def transform(self, X):
        return self.voter.transform(X)

    def predict(self, X):
        return self.voter.predict(X)

    def predict_proba(self, X):
        return self.voter.predict_proba(X)

    def set_params(self, **params):
        self.voter._set_params('estimators', **params)
        return self

    def get_params(self, deep=True):
        return self.voter._get_params('estimators', deep = deep)
```

You can see this code implemented [here](https://github.com/donaldrauscher/hospital-readmissions).  I'm building a model to predict which recently hospitalized diabetic patients will be re-hospitalized within 30 days, using [this dataset](https://archive.ics.uci.edu/ml/datasets/diabetes+130-us+hospitals+for+years+1999-2008) from UCI.  My model stack contained a logistic regression with regularization, a random forest, and a gradient boosting (xgboost) model.  Here is a summary of model performance:

<table class="pretty">
<tr><th>Model</th><th>AUC</th></tr>
<tr><td>Optimal Blend (10% LR, 60% RF, 30% XGB)</td><td>0.696693964530</td></tr>
<tr><td>Avg</td><td>0.695085617513</td></tr>
<tr><td>Logistic Regression</td><td>0.683649058796</td></tr>
<tr><td>Random Forest</td><td>0.694950165587</td></tr>
<tr><td>XGBoost</td><td>0.689625026265</td></tr>
</table>

As you can see, a simple average of the models outperforms any one model.  And our optimal blend (10% LR, 60% RF, and 30% XGB) outperforms the simple average.

Another technique that I'd like to explore is [feature-weighted linear stacking](https://arxiv.org/pdf/0911.0460.pdf): tuning a meta model using interactions of meta features and input model predictions, the idea being that we can identify pockets of samples in which certain models perform best.  More on this later!
