---
layout: post
title: 'Easy BI: Setting up Redash on GKE'
date:   2017-12-31
tags: [business_intelligence, redash, gke, gcp]
permalink: /redash-gke
---

Steps:
1. Create Postgres instance on CloudSQL; also:
- Create a service account that the CloudSQL proxy on Kubernetes will use
- Create a Postgres user to be used by the Redash app
- Create `redash` database for our application
2. Create a cluster for our app.  Add secret for service account for CloudSQL proxy.
3. Deploy initialization which will initialize tables in the database.  Then delete.
4. Final deployment and service.  No need for nginx container since that is handled by Kubernetes service.

Inspirations:
- Most of this was adapted from the Redash [Docker compose file](https://github.com/getredash/redash/blob/master/docker-compose.production.yml)
- [This repo](https://github.com/nanit/redash-kubernetes) doing something similar
- [This tutorial](https://cloud.google.com/sql/docs/mysql/connect-kubernetes-engine) from Google on how to connect Kubernetes clusters to CloudSQL.

TODO: Parameterize Kubernetes manifest with https://github.com/jimmycuadra/ktmpl
