<!--
Copyright 2020 Google LLC

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
-->
# `deploy-cloudrun` GitHub Action

Deploys your container image to [Cloud Run][cloud-run] and makes the URL
available to later build steps via outputs.


## Prerequisites

This action requires:

-   Google Cloud credentials that are authorized to deploy a Cloud Run service.
    See the [Credentials](#credentials) below for more information.

-   [Enable the Cloud Run API](http://console.cloud.google.com/apis/library/run.googleapis.com)

-   This action runs using Node 16. If you are using self-hosted GitHub Actions
    runners, you must use runner version [2.285.0](https://github.com/actions/virtual-environments)
    or newer.


## Usage

```yaml
jobs:
  job_id:
    permissions:
      contents: 'read'
      id-token: 'write'

    steps:
    - id: 'auth'
      uses: 'google-github-actions/auth@v0'
      with:
        workload_identity_provider: 'projects/123456789/locations/global/workloadIdentityPools/my-pool/providers/my-provider'
        service_account: 'my-service-account@my-project.iam.gserviceaccount.com'

    - id: 'deploy'
      uses: 'google-github-actions/deploy-cloudrun@v0'
      with:
        service: 'hello-cloud-run'
        image: 'gcr.io/cloudrun/hello'

    - name: 'Use output'
      run: 'curl "${{ steps.deploy.outputs.url }}"'
```

## Inputs

| Name          | Requirement | Default | Description |
| ------------- | ----------- | ------- | ----------- |
| `service`| Required if not using a service YAML via `metadata` input. | | ID of the service or fully qualified identifier for the service. |
| `image`| Required if not using a service YAML via `metadata` input. | | Name of the container image to deploy (Example: `gcr.io/cloudrun/hello:latest`). |
| `region`| _optional_ | `us-central1` | Region in which the resource can be found. |
| `env_vars`| _optional_ | | List of key-value pairs to set as environment variables in the format: `KEY1=VALUE1,KEY2=VALUE2`. **All existing environment variables will be retained**. |
| `secrets`| _optional_ | | List of key-value pairs to set as either environment variables or mounted volumes in the format: `KEY1=secret-key-1:latest,/secrets/api/key=secret-key-2:latest`. The secrets will be fetched from the Secret Manager. The service identity must have permissions to read the secrets. Multiple secrets can be split across multiple lines: <pre>secrets: \|<br>&emsp;&emsp;SECRET_NAME=secret_name<br>&emsp;&emsp;SECRET_NAME2=secret_name2</pre> <br>**All existing environment secrets or volumes will be retained**. |
| `metadata`| _optional_ | | YAML service description for the Cloud Run service (**Other inputs will be overridden**). See [Metadata customizations](#metadata-customizations) for more information. |
| `project_id`| _optional_ | | ID of the Google Cloud project. If provided, this will override the project configured by `setup-gcloud`. |
| `source` | _optional_ | | Deploy from source by specifying the source directory. The [Artifact Registry API][artifact-api] needs to be enabled and the service account role `Cloud Build Service Account` is required. The first deployment will create an [Artifact Registry repository][repo] which requires the `Artifact Registry Admin` role. Learn more about [Deploying from source code](https://cloud.google.com/run/docs/deploying-source-code). |
| `suffix` | _optional_ | | Specify the suffix of the revision name. Revision names always start with named 'helloworld', would lead to a revision named 'helloworld-v1'. |
| `tag` | _optional_ | | Traffic tag to assign to the newly created revision. |
| `timeout` | _optional_ | | Set the maximum request execution time. It is specified as a duration; for example, "10m5s" is ten minutes and five seconds. If you don't specify a unit, seconds is assumed. |
| `no_traffic` | _optional_ | `false` | Set to `true` to avoid sending traffic to the revision being deployed.|
| `revision_traffic` | _optional_ | | Comma separated list of traffic assignments in the form REVISION-NAME=PERCENTAGE. |
| `tag_traffic` | _optional_ | | Comma separated list of traffic assignments in the form TAG=PERCENTAGE. |
| `labels` | _optional_ | | List of key-value pairs to set as labels of cloud run service in the format: KEY1=VALUE1,KEY2=VALUE2. Existing labels will be retained. |
| `flags` | _optional_ | | Space separated list of other Cloud Run flags, examples can be found: https://cloud.google.com/sdk/gcloud/reference/run/deploy#FLAGS. |
| `gcloud_version` | _optional_ | `latest` | Pin the version of Cloud SDK `gcloud` CLI. |
| `gcloud_component` | _optional_ | | Pin the Cloud SDK `gcloud` CLI components version, valid values are `alpha` or `beta`. |
| `credentials`| Required if not using the `setup-gcloud` action with exported credentials. | | (**Deprecated**) This input is deprecated. See [auth section](https://github.com/google-github-actions/deploy-cloudrun#via-google-github-actionsauth) for more details. Service account key to use for authentication. This should be the JSON formatted private key which can be exported from the Cloud Console. The value can be raw or base64-encoded.  |

### Metadata customizations

You can store your service specification in a YAML file. This will allow for
further service configuration, such as [memory limits](https://cloud.google.com/run/docs/configuring/memory-limits),
[CPU allocation](https://cloud.google.com/run/docs/configuring/cpu),
[max instances](https://cloud.google.com/run/docs/configuring/max-instances),
and [more](https://cloud.google.com/sdk/gcloud/reference/run/deploy#OPTIONAL-FLAGS).
**Other inputs will be overridden when using `metadata`**

- See [Deploying a new service](https://cloud.google.com/run/docs/deploying#yaml)
to create a new YAML service definition, for example:

```YAML
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: SERVICE
spec:
  template:
    spec:
      containers:
      - image: IMAGE
```

- See [Deploy a new revision of an existing service](https://cloud.google.com/run/docs/deploying#yaml_1)
to generated a YAML service specification from an existing service:

```
gcloud run services describe SERVICE --format yaml > service.yaml
```
### Allow unauthenticated requests

A Cloud Run product recommendation is that CI/CD systems not set or change
settings for allowing unauthenticated invocations. New deployments are
automatically private services, while deploying a revision of a public
(unauthenticated) service will preserve the IAM setting of public
(unauthenticated). For more information, see [Controlling access on an individual service](https://cloud.google.com/run/docs/securing/managing-access).

## Outputs

- `url`: The URL of your Cloud Run service.

## Credentials

### Via google-github-actions/auth

Use [google-github-actions/auth](https://github.com/google-github-actions/auth) to authenticate the action. This Action supports both the recommended [Workload Identity Federation][wif] based authentication and the traditional [Service Account Key JSON][sa] based auth.

See [usage](https://github.com/google-github-actions/auth#usage) for more details.

A service account will be needed
with the following roles:

- Cloud Run Admin (`roles/run.admin`):
  - Can create, update, and delete services.
  - Can get and set IAM policies.

This service account needs to be a member of the `Compute Engine default service account`,
`(PROJECT_NUMBER-compute@developer.gserviceaccount.com)`, with role
`Service Account User`. To grant a user permissions for a service account, use
one of the methods found in [Configuring Ownership and access to a service account](https://cloud.google.com/iam/docs/granting-roles-to-service-accounts#granting_access_to_a_user_for_a_service_account).

#### Authenticating via Workload Identity Federation

```yaml
jobs:
  job_id:
    permissions:
      contents: 'read'
      id-token: 'write'

    steps:
    - uses: actions/checkout@v3
    - id: 'auth'
      uses: 'google-github-actions/auth@v0'
      with:
        workload_identity_provider: 'projects/123456789/locations/global/workloadIdentityPools/my-pool/providers/my-provider'
        service_account: 'my-service-account@my-project.iam.gserviceaccount.com'

    - name: 'Deploy to Cloud Run'
      uses: 'google-github-actions/deploy-cloudrun@v0'
      with:
        image: 'gcr.io/cloudrun/hello'
        service: 'hello-cloud-run'
```

#### Authenticating via Service Account Key JSON

```yaml
jobs:
  job_id:
    steps:
    - id: 'auth'
      uses: 'google-github-actions/auth@v0'
      with:
        credentials_json: '${{ secrets.GCP_SA_KEY }}'

    - name: 'Deploy to Cloud Run'
      uses: 'google-github-actions/deploy-cloudrun@v0'
      with:
        image: 'gcr.io/cloudrun/hello'
        service: 'hello-cloud-run'
```

### Via Application Default Credentials

If you are hosting your own runners, **and** those runners are on Google Cloud,
you can leverage the Application Default Credentials of the instance. This will
authenticate requests as the service account attached to the instance. **This
only works using a custom runner hosted on GCP.**

```yaml
jobs:
  job_id:
    steps:
    - name: 'Deploy to Cloud Run'
      uses: 'google-github-actions/deploy-cloudrun@v0'
      with:
        image: 'gcr.io/cloudrun/hello'
        service: 'hello-cloud-run'
```

## Example Workflows

* [Deploy from source](https://github.com/google-github-actions/example-workflows/blob/main/workflows/deploy-cloudrun/cloudrun-source.yml)

* [Build and deploy a container](https://github.com/google-github-actions/example-workflows/blob/main/workflows/deploy-cloudrun/cloudrun-docker.yml)

## Migrating from `setup-gcloud`

Example using `setup-gcloud`:

```YAML
jobs:
  job_id:
    steps:
    - name: 'Setup Cloud SDK'
      uses: 'google-github-actions/setup-gcloud@v0'
      with:
        project_id: '${{ env.PROJECT_ID }}'
        service_account_key: '${{ secrets.GCP_SA_KEY }}'

    - name: 'Deploy to Cloud Run'
      run: |-
        gcloud run deploy $SERVICE \
          --region $REGION \
          --image gcr.io/$PROJECT_ID/$SERVICE \
          --platform managed \
          --set-env-vars NAME="Hello World"
```

Migrated to `deploy-cloudrun`:

```YAML
jobs:
  job_id:
    steps:
    - id: 'auth'
      uses: 'google-github-actions/auth@v0'
      with:
        credentials_json: '${{ secrets.GCP_SA_KEY }}'

    - name: 'Deploy to Cloud Run'
      uses: 'google-github-actions/deploy-cloudrun@v0'
      with:
        service: '${{ env.SERVICE }}'
        image: 'gcr.io/${{ env.PROJECT_ID }}/${{ env.SERVICE }}'
        region: '${{ env.REGION }}'
        env_vars: 'NAME="Hello World"'
```
Note: The action is for the "managed" platform and will not set access privileges such as [allowing unauthenticated requests](#Allow-unauthenticated-requests).

## Versioning

We recommend pinning to the latest available major version:

```yaml
- uses: 'google-github-actions/deploy-cloudrun@v0'
```

While this action attempts to follow semantic versioning, but we're ultimately
human and sometimes make mistakes. To prevent accidental breaking changes, you
can also pin to a specific version:

```yaml
- uses: 'google-github-actions/deploy-cloudrun@v0.1.1'
```

However, you will not get automatic security updates or new features without
explicitly updating your version number. Note that we only publish `MAJOR` and
`MAJOR.MINOR.PATCH` versions. There is **not** a floating alias for
`MAJOR.MINOR`.


[cloud-run]: https://cloud.google.com/run
[sa]: https://cloud.google.com/iam/docs/creating-managing-service-accounts
[wif]: https://cloud.google.com/iam/docs/workload-identity-federation
[create-key]: https://cloud.google.com/iam/docs/creating-managing-service-account-keys
[gh-runners]: https://help.github.com/en/actions/hosting-your-own-runners/about-self-hosted-runners
[gh-secret]: https://help.github.com/en/actions/configuring-and-managing-workflows/creating-and-storing-encrypted-secrets
[setup-gcloud]: ./setup-gcloud
[artifact-api]: https://console.cloud.google.com/flows/enableapi?apiid=artifactregistry.googleapis.com&redirect=https://cloud.google.com/artifact-registry/docs/docker/quickstart
[repo]: https://cloud.google.com/artifact-registry/docs/manage-repos
