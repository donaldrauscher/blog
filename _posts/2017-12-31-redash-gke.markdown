---
layout: post
title: 'Quick and Easy BI: Setting up Redash on GKE'
date:   2017-12-31
tags: [business_intelligence, redash, gke, gcp]
permalink: /redash-gke
---

Professionally, I have worked quite a lot with BI platforms Looker and Tableau. They are great BI platforms for an organization, though probably too heavy (and too expensive) for a small project or a bootstrapping startup.  Sometimes you just need something where you can write queries and dump them into a visualization.  Recently, I was looking to implement a lightweight BI tool for a personal project.  I chose to use [Redash](https://redash.io/), which you can [self-host](https://redash.io/help-onpremise/setup/setting-up-redash-instance.html) on your own infrastructure.  This post documents how to set up Redash on Google Cloud using GKE.  Because I am using CloudSQL as the Postgres backend and a persistent drive for Redis, we can delete our cluster when we're not using it and spin it back up as needed, without losing any data!

## Infrastructure Setup

We will use the following Google Cloud components to set up Redash:
* Postgres DB (via CloudSQL)
* Persistent disk for Redis instance
* Kubernetes cluster for Redash Docker image

Here is a [Terraform](https://www.terraform.io) configuration which defines all the necessary infrastructure:
``` bash
variable "project" {}
variable "postgres_user" {}
variable "postgres_pw" {}

variable "region" {
  default = "us-central1"
}

variable "zone" {
  default = "us-central1-f"
}

provider "google" {
  version = "~> 1.4"
  project = "${var.project}"
  region = "${var.region}"
}

resource "google_compute_disk" "redash-redis-disk" {
  name  = "redash-redis-disk"
  type  = "pd-ssd"
  size = "200"
  zone  = "${var.zone}"
}

resource "google_sql_database_instance" "redash-db" {
  name = "redash-db"
  database_version = "POSTGRES_9_6"
  region = "${var.region}"
  settings {
    tier = "db-f1-micro"
  }
}

resource "google_sql_database" "redash-schema" {
  name = "redash"
  instance = "${google_sql_database_instance.redash-db.name}"
}

resource "google_sql_user" "proxyuser" {
  name = "${var.postgres_user}"
  password = "${var.postgres_pw}"
  instance = "${google_sql_database_instance.redash-db.name}"
  host = "cloudsqlproxy~%"
}

resource "google_container_cluster" "redash-cluster" {
  name = "redash-cluster"
  zone = "${var.zone}"
  initial_node_count = "1"
  node_config {
    machine_type = "n1-standard-4"
  }
}
```

We will also need to create a service account that the CloudSQL proxy on Kubernetes will use.  Create that (Role = "Cloud SQL Client") and download the JSON key.  Once Kubernetes cluster is up, we need to attach a secret containing the previously-created service account.  And, if you haven't already, fetch credentials so that you can run `kubectl` commands on your cluster.
``` bash
gcloud container clusters get-credentials redash-cluster
gcloud config set container/cluster redash-cluster

kubectl create secret generic cloudsql-instance-credentials \
    --from-file=credentials.json=[PROXY_KEY_FILE_PATH]
```

## Redash Deployment

Next, we need to deploy Redash on our Kubernetes cluster.  This is done in three steps:
1. Set up a Redis service and a CloudSQL proxy so our Redash instances can access their Postgres backend in CloudSQL
2. Kick off initialization [Job](https://kubernetes.io/docs/concepts/workloads/controllers/jobs-run-to-completion/) which will create the Redash app's tables in the `redash` schema
3. Deploy the Redash app (1 server + 2 workers)

``` bash
ktmpl k8s/redash-resources.yaml --parameter-file config.yaml | kubectl apply -f -
ktmpl k8s/redash-init.yaml --parameter-file config.yaml | kubectl apply -f -
ktmpl k8s/redash.yaml --parameter-file config.yaml | kubectl apply -f -
```

Redash resources:
``` yaml
---
kind: Template
apiVersion: v1
metadata:
  name: redash-resources-template
parameters:
  - name: POSTGRES_CONN_NAME
    description: "Connection name for CloudSQL instance, e.g. myproject1:us-central1:myinstance1"
    required: true
    parameterType: string
objects:
  - kind: Service
    apiVersion: v1
    metadata:
      name: redash-resources
    spec:
      type: ClusterIP
      selector:
        app: redash-resources
      ports:
        - name: postgres
          port: 5432
        - name: redis
          port: 6379
  - kind: Deployment
    apiVersion: extensions/v1beta1
    metadata:
      name: redash-resources
      labels:
        app: redash-resources
    spec:
      replicas: 1
      template:
        metadata:
          name: redash-resources
          labels:
            app: redash-resources
        spec:
          containers:
            - name: cloudsql-proxy
              image: gcr.io/cloudsql-docker/gce-proxy:1.11
              command: ["/cloud_sql_proxy", "--dir=/cloudsql",
                        "-instances=$(POSTGRES_CONN_NAME)=tcp:0.0.0.0:5432",
                        "-credential_file=/secrets/cloudsql/credentials.json"]
              ports:
                - name: postgres
                  containerPort: 5432
              volumeMounts:
                - name: cloudsql-instance-credentials
                  mountPath: /secrets/cloudsql
                  readOnly: true
                - name: ssl-certs
                  mountPath: /etc/ssl/certs
                - name: cloudsql
                  mountPath: /cloudsql
            - name: redis
              image: redis:3.0-alpine
              ports:
                - name: redis
                  containerPort: 6379
              volumeMounts:
                - name: redis-disk
                  mountPath: /data/redis
          volumes:
            - name: cloudsql-instance-credentials
              secret:
                secretName: cloudsql-instance-credentials
            - name: cloudsql
              emptyDir:
            - name: ssl-certs
              hostPath:
                path: /etc/ssl/certs
            - name: redis-disk
              gcePersistentDisk:
                pdName: redash-redis-disk
                fsType: ext4
```

Redash DB initialization job:
``` yaml
---
kind: Template
apiVersion: v1
metadata:
  name: redash-init-template
parameters:
  - name: POSTGRES_USER
    required: true
    parameterType: string
  - name: POSTGRES_PW
    required: true
    parameterType: string
objects:
  - kind: Job
    apiVersion: batch/v1
    metadata:
      name: redash-init
    spec:
      template:
        metadata:
          labels:
            app: redash-init
        spec:
          restartPolicy: Never
          containers:
            - name: redash-init
              image: redash/redash:latest
              resources:
                requests:
                  memory: 1Gi
              env:
                - name: REDASH_DATABASE_URL
                  value: postgresql://$(POSTGRES_USER):$(POSTGRES_PW)@redash-resources:5432/redash
                - name: REDASH_REDIS_URL
                  value: "redis://redash-resources:6379/0"
                - name: PYTHONUNBUFFERED
                  value: "0"
                - name: REDASH_LOG_LEVEL
                  value: "INFO"
              args: ["create_db"]
```

Redash deployment:
``` yaml
---
kind: Template
apiVersion: v1
metadata:
  name: redash-template
parameters:
  - name: POSTGRES_USER
    required: true
    parameterType: string
  - name: POSTGRES_PW
    required: true
    parameterType: string
  - name: REDASH_COOKIE_SECRET
    required: true
    parameterType: string
objects:
  - kind: Service
    apiVersion: v1
    metadata:
      name: redash
    spec:
      type: LoadBalancer
      selector:
        app: redash
      ports:
        - port: 80
          targetPort: redash-http
  - kind: Deployment
    apiVersion: extensions/v1beta1
    metadata:
      name: redash
    spec:
      replicas: 1
      template:
        metadata:
          labels:
            app: redash
        spec:
          containers:
            - name: redash
              image: redash/redash:latest
              resources:
                requests:
                  memory: 1Gi
              ports:
                - name: redash-http
                  containerPort: 5000
              env:
                - name: REDASH_DATABASE_URL
                  value: "postgresql://$(POSTGRES_USER):$(POSTGRES_PW)@redash-resources:5432/redash"
                - name: REDASH_REDIS_URL
                  value: "redis://redash-resources:6379/0"
                - name: PYTHONUNBUFFERED
                  value: "0"
                - name: REDASH_COOKIE_SECRET
                  value: "$(REDASH_COOKIE_SECRET)"
                - name: REDASH_LOG_LEVEL
                  value: "INFO"
              args: ["server"]
            - name: redash-workers
              image: redash/redash:latest
              resources:
                requests:
                  memory: 1Gi
              env:
                - name: REDASH_DATABASE_URL
                  value: "postgresql://$(POSTGRES_USER):$(POSTGRES_PW)@redash-resources:5432/redash"
                - name: REDASH_REDIS_URL
                  value: "redis://redash-resources:6379/0"
                - name: WORKERS_COUNT
                  value: "2"
                - name: QUEUES
                  value: "queries,scheduled_queries,celery"
                - name: PYTHONUNBUFFERED
                  value: "0"
                - name: REDASH_LOG_LEVEL
                  value: "INFO"
              args: ["scheduler"]
```

Note: In Terraform, you can define [variables](https://www.terraform.io/intro/getting-started/variables.html) to pipe in parameter values throughout your configuration; I stored parameter values in a separate `terraform.tfvars` file which Terraform loads automatically.  Unfortunately, Kubernetes [does not have a native solution](https://github.com/kubernetes/kubernetes/issues/11492) for this.  Though I do use a nifty tool called [`ktmpl`](https://github.com/jimmycuadra/ktmpl) to do client-side parameter substitutions in my Kubernetes manifests.

You can find all of my code up on my GitHub [here](https://github.com/donaldrauscher/redash-gke).  Cheers!

<img src="/assets/img/redash-example.png" width="885px" style="display:block; margin-left:auto; margin-right:auto;">
