---
layout: post
title: 'Setting up Apache Airflow on GKE'
date:   2018-02-06
tags: [etl, pipelining, airflow, gke, gcp]
permalink: /airflow-gke
---

Historically, I have used [Luigi](https://luigi.readthedocs.io/en/latest/) for a lot of my data pipelining.  Recently, however, I have started experimenting with [Airflow](https://airflow.apache.org/) for [a variety of reasons](https://www.quora.com/Which-is-a-better-data-pipeline-scheduling-platform-Airflow-or-Luigi).  Some things I really like about Airflow:
- **Easier to parallize** - Luigi can only be scaled *locally*.  You can create multiple worker threads by passing `--workers N` when kicking off a job, but you cannot parallelize Luigi jobs across multiple machines!  Airflow parallelizes quite well.  For instance, you can use [Celery](https://airflow.apache.org/configuration.html#scaling-out-with-celery) to scale out your workers.
- **Superior scheduler** - The Luigi "central scheduler" is a bit of a misnomer; it doesn't actually schedule anything!  Its main purpose is to prevent worker threads from running the same task concurrently. That's it. You still need to initiate Luigi jobs with a cronjob.  The Airflow scheduler is *much* more useful. You can use it to set up a cronjob-like schedule for a DAG and even initiate retries following errors.  
- **Connection management** - Airflow has a nice mechanism for organizing [connections](https://airflow.apache.org/concepts.html#connections) to your resources.  This is really useful, especially in a multiuser environment.  It allows you to avoid storing secrets in .gitignore'd config files all over the place.
- **Better ongoing support** - Luigi, originally open sourced at Spotify, is currently maintained on a ["for fun basis"](https://github.com/tarrasch) by Arash Rouhani, who currently works at Google.  Meanwhile, Airflow, originally open sourced at Airbnb, is being incubated by Apache.  

Given that I have been on a Docker/Kubernetes bender of-late, I decided to spend some time setting up Airflow on GKE.  I leveraged [an awesome Docker image with Airflow](https://github.com/puckel/docker-airflow) from Matthieu Roisil.  I used a Postgres instance on CloudSQL for the Airflow meta database and Redis as the Celery backend. Also used [git-sync](https://github.com/kubernetes/git-sync) sidecar container to continuously sync DAGs and plugins on running cluster, so you only need to rebuild the Docker image when changing the Python environment!  Finally, I used Terraform for managing all my GCP infrastructure.

## Kubernetes Manifest

Note: I used [`ktmpl`](https://github.com/jimmycuadra/ktmpl) for performing parameter substitutions in Kubernetes manifest.

``` yaml
# airflow-k8s.yaml
kind: Template
apiVersion: v1
metadata:
  name: airflow-k8s-template
parameters:
  - name: PROJECT_ID
    required: true
    parameterType: string
  - name: FERNET_KEY
    required: true
    parameterType: string
  - name: DAG_REPO
    required: true
    parameterType: string
objects:
  - apiVersion: v1
    kind: ConfigMap
    metadata:
      name: config-airflow
    data:
      EXECUTOR: Celery
      POSTGRES_USER: airflow
      POSTGRES_DB: airflow
      POSTGRES_HOST: postgres
      POSTGRES_PORT: "5432"
      REDIS_HOST: redis
      REDIS_PORT: "6379"
      FLOWER_PORT: "5555"
      FERNET_KEY: "$(FERNET_KEY)"
      AIRFLOW__CORE__DAGS_FOLDER: "/git/git/dags/"
      AIRFLOW__CORE__PLUGINS_FOLDER: "/git/git/plugins/"
      AIRFLOW__CORE__LOAD_EXAMPLES: "0"
  - apiVersion: v1
    kind: ConfigMap
    metadata:
      name: config-git-sync
    data:
      GIT_SYNC_REPO: "$(DAG_REPO)"
      GIT_SYNC_DEST: git
  - apiVersion: v1
    kind: Service
    metadata:
      name: web
    spec:
      type: LoadBalancer
      selector:
        app: airflow
        tier: web
      ports:
        - name: web
          port: 8080
  - apiVersion: v1
    kind: Service
    metadata:
      name: flower
    spec:
      type: LoadBalancer
      selector:
        app: airflow
        tier: flower
      ports:
        - name: flower
          port: 5555
  - kind: Service
    apiVersion: v1
    metadata:
      name: postgres
    spec:
      type: ClusterIP
      selector:
        app: airflow
        tier: postgres
      ports:
        - name: postgres
          port: 5432
          protocol: TCP
  - kind: Service
    apiVersion: v1
    metadata:
      name: redis
    spec:
      type: ClusterIP
      selector:
        app: airflow
        tier: redis
      ports:
        - name: redis
          port: 6379
  - kind: Deployment
    apiVersion: extensions/v1beta1
    metadata:
      name: postgres
    spec:
      replicas: 1
      template:
        metadata:
          labels:
            app: airflow
            tier: postgres
        spec:
          restartPolicy: Always
          containers:
            - name: cloudsql-proxy
              image: gcr.io/cloudsql-docker/gce-proxy:1.11
              command: ["/cloud_sql_proxy", "--dir=/cloudsql",
                        "-instances=$(PROJECT_ID):us-central1:airflow-db=tcp:0.0.0.0:5432",
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
          volumes:
            - name: cloudsql-instance-credentials
              secret:
                secretName: cloudsql-instance-credentials
            - name: cloudsql
              emptyDir:
            - name: ssl-certs
              hostPath:
                path: /etc/ssl/certs
  - kind: Deployment
    apiVersion: extensions/v1beta1
    metadata:
      name: redis
    spec:
      replicas: 1
      template:
        metadata:
          labels:
            app: airflow
            tier: redis
        spec:
          restartPolicy: Always
          containers:
            - name: redis
              image: redis:3.0-alpine
              ports:
                - name: redis
                  containerPort: 6379
              volumeMounts:
                - name: redis-disk
                  mountPath: /data/redis
          volumes:
            - name: redis-disk
              gcePersistentDisk:
                pdName: airflow-redis-disk
                fsType: ext4
  - apiVersion: extensions/v1beta1
    kind: Deployment
    metadata:
      name: web
    spec:
      replicas: 1
      template:
        metadata:
          labels:
            app: airflow
            tier: web
        spec:
          restartPolicy: Always
          containers:
            - name: web
              image: gcr.io/$(PROJECT_ID)/airflow-gke:latest
              ports:
                - name: web
                  containerPort: 8080
              volumeMounts:
              - name: dagbag
                mountPath: /git
              envFrom:
              - configMapRef:
                  name: config-airflow
              livenessProbe:
                httpGet:
                  path: /health
                  port: 8080
                initialDelaySeconds: 60
                timeoutSeconds: 30
              command: ["/entrypoint.sh"]
              args:  ["webserver"]
            - name: git-sync
              image: gcr.io/google_containers/git-sync:v2.0.4
              volumeMounts:
              - name: dagbag
                mountPath: /git
              envFrom:
              - configMapRef:
                  name: config-git-sync
          volumes:
            - name: dagbag
              emptyDir: {}
  - apiVersion: extensions/v1beta1
    kind: Deployment
    metadata:
      name: scheduler
    spec:
      replicas: 1
      template:
        metadata:
          labels:
            app: airflow
            tier: scheduler
        spec:
          restartPolicy: Always
          containers:
            - name: scheduler
              image: gcr.io/$(PROJECT_ID)/airflow-gke:latest
              volumeMounts:
              - name: dagbag
                mountPath: /git
              envFrom:
              - configMapRef:
                  name: config-airflow
              command: ["/entrypoint.sh"]
              args:  ["scheduler"]
            - name: git-sync
              image: gcr.io/google_containers/git-sync:v2.0.4
              volumeMounts:
              - name: dagbag
                mountPath: /git
              envFrom:
              - configMapRef:
                  name: config-git-sync
          volumes:
            - name: dagbag
              emptyDir: {}
  - apiVersion: extensions/v1beta1
    kind: Deployment
    metadata:
      name: worker
    spec:
      replicas: 2
      template:
        metadata:
          labels:
            app: airflow
            tier: worker
        spec:
          restartPolicy: Always
          containers:
            - name: worker
              image: gcr.io/$(PROJECT_ID)/airflow-gke:latest
              volumeMounts:
              - name: dagbag
                mountPath: /git
              envFrom:
              - configMapRef:
                  name: config-airflow
              command: ["/entrypoint.sh"]
              args:  ["worker"]
            - name: git-sync
              image: gcr.io/google_containers/git-sync:v2.0.4
              volumeMounts:
              - name: dagbag
                mountPath: /git
              envFrom:
              - configMapRef:
                  name: config-git-sync
          volumes:
            - name: dagbag
              emptyDir: {}
  - apiVersion: extensions/v1beta1
    kind: Deployment
    metadata:
      name: flower
    spec:
      replicas: 1
      template:
        metadata:
          labels:
            app: airflow
            tier: flower
        spec:
          restartPolicy: Always
          containers:
          - name: flower
            image: gcr.io/$(PROJECT_ID)/airflow-gke:latest
            ports:
            - name: flower
              containerPort: 5555
            envFrom:
            - configMapRef:
                name: config-airflow
            command: ["/entrypoint.sh"]
            args:  ["flower"]
```

## Deploy Instructions

(1) Store project id, git repo, and Fernet key as env variables:
``` bash
export PROJECT_ID=$(gcloud config get-value project -q)
export DAG_REPO=$(git remote get-url --all origin)

if [ ! -f './fernet.key' ]; then
  export FERNET_KEY=$(python -c "from cryptography.fernet import Fernet; FERNET_KEY = Fernet.generate_key().decode(); print(FERNET_KEY)")
  echo $FERNET_KEY > fernet.key
else
  export FERNET_KEY=$(cat fernet.key)
fi
```

(2) Create Docker image and upload to Google Container Repository:
``` bash
docker build -t airflow-gke:latest .
docker tag airflow-gke gcr.io/${PROJECT_ID}/airflow-gke:latest
gcloud docker -- push gcr.io/${PROJECT_ID}/airflow-gke
```

(3) Create infrastructure with Terraform:
``` bash
terraform apply -var $(printf 'project=%s' $PROJECT_ID)
```

(4) Deploy on Google Kubernetes Engine:

Note: You will also need to create a Service Account for the CloudSQL proxy in Kubernetes.  Create that (Role = "Cloud SQL Client") and download the JSON key.  Stored in `.keys/airflow-cloud.json` in this example.

``` bash
gcloud container clusters get-credentials airflow-cluster
gcloud config set container/cluster airflow-cluster

kubectl create secret generic cloudsql-instance-credentials \
  --from-file=credentials.json=.keys/airflow-cloudsql.json

ktmpl airflow-k8s.yaml \
  --parameter PROJECT_ID ${PROJECT_ID} \
  --parameter FERNET_KEY ${FERNET_KEY} \
  --parameter DAG_REPO ${DAG_REPO} | kubectl apply -f -
```

## Test Pipeline

The example pipeline (`citibike.py`) streams data from [this Citibike API](https://gbfs.citibikenyc.com/gbfs/en/station_status.json) into Google BigQuery.  I had a lot of issues with the GCP contrib classes in Airflow ([BQ hook](https://github.com/apache/incubator-airflow/blob/master/airflow/contrib/hooks/bigquery_hook.py) did not support BQ streaming, [base GCP hook](https://github.com/apache/incubator-airflow/blob/master/airflow/contrib/hooks/gcp_api_base_hook.py) based on now-deprecated `oauth2client` library instead of `google-auth`) so I built my own plugin!

Note: To run Citibike example pipeline, will need to create a Service Account with BigQuery access and add to the `google_cloud_default` connection in the Airflow UI.

\-\-\-

Overall, I'm really excited to start using Airflow for more of my data pipelining.  Here is a [link](https://github.com/donaldrauscher/airflow-gke) to all my code on GitHub.  Cheers!
