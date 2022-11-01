# deploy-cloudrun

The `deploy-cloudrun` GitHub Action deploys to Google [Cloud Run][cloud-run]. It
can deploy a container image or from source, and the resulting service URL is
available as a GitHub Actions output for use in future steps.


## Prerequisites

-   For authenticating to Google Cloud, you must create a Workload Identity
    Provider or export credentials. See [Credentials](#credentials) for more
    information.

-   For deploying from source, you must run the `actions/checkout@v3` step
    _before_ this action.

-   You must [enable the Cloud Run API](http://console.cloud.google.com/apis/library/run.googleapis.com).

-   This action runs using Node 16. If you are using self-hosted GitHub Actions
    runners, you must use runner version [2.285.0](https://github.com/actions/virtual-environments)
    or newer.


## Usage

```yaml
jobs:
  job_id:
    # ...

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

-   `service`: (Required, unless providing `metadata`) ID of the service or
    fully-qualified identifier of the service.

-   `image`: (Required, unless providing `metadata` or `source`) Fully-qualified
    name of the container image to deploy. For example:

    ```text
    gcr.io/cloudrun/hello:latest
    ```

    or

    ```text
    us-docker.pkg.dev/my-project/my-container/image:1.2.3
    ```

-   `source`: (Required, unless providing `metadata` or `image`) Path to source
    to deploy. If specified, this will deploy the Cloud Run service from the
    code specified at the given source directory.

    This requires the [Artifact Registry API][artifact-api] to be enabled.
    Furthermore, the deploying service account must have the `Cloud Build
    Service Account` role. The initial deployment will create an [Artifact
    Registry repository][repo] which requires the `Artifact Registry Admin`
    role.

    Learn more about [Deploying from source
    code](https://cloud.google.com/run/docs/deploying-source-code).

-   `suffix`: (Optional) String suffix to append to the revision name. The
    default value is no suffix.

-   `env_vars`: (Optional) List of key=value pairs to set as environment
    variables. All existing environment variables will be retained.

    ```yaml
    with:
      env_vars: |
        FOO=bar
        ZIP=zap
    ```

-   `secrets`: (Optional) List of key=value pairs to use as secrets. These can
    either be injected as environment variables or mounted as volumes. All
    existing environment secrets and volume mounts will be retained.

    ```yaml
    with:
      secrets: |
        # As an environment variable:
        KEY1=secret-key-1:latest

        # As a volume mount:
        /secrets/api/key=secret-key-2:latest
    ```

-   `labels`: (Optional) List of key=value pairs to set as labels on the Cloud
    Run service. Existing labels will be overwritten.

    ```yaml
    with:
      labels:
        my-label=my-value
    ```

    The GitHub Action will automatically apply the following labels which Cloud
    Run uses to enhance the user experience:

    ```text
    managed-by: github-actions
    commit-sha: <sha>
    ```

    Labels have strict naming and casing requirements. See [Requirements for
    labels](https://cloud.google.com/resource-manager/docs/creating-managing-labels#requirements)
    for more information.

-   `tag`: (Optional) Traffic tag to assign to the newly-created revision.

-   `timeout`: (Optional) Maximum request execution time, specified as a
    duration like "10m5s" for ten minutes and 5 seconds.

-   `flags`: (Optional) Space separate list of other Cloud Run flags. This can
    be used to access features that are not exposed via this GitHub Action.

    ```yaml
    with:
      flags: '--add-cloudsql-instances=...'
    ```

    See the [complete list of
    flags](https://cloud.google.com/sdk/gcloud/reference/run/deploy#FLAGS) for
    more information.

-   `no_traffic`: (Optional) If true, the newly deployed revision will not
    receive traffic. The default value is false.

-   `revision_traffic`: (Optional, mutually-exclusive with `tag_traffic`)
    Comma-separated list of revision traffic assignments.

    ```yaml
    with:
      revision_traffic: 'my-revision=10' # percentage
    ```

-   `tag_traffic`: (Optional, mutually-exclusive with `revision_traffic`)
    Comma-separated list of tag traffic assignments.

    ```yaml
    with:
      tag_traffix: 'my-tag=10' # percentage
    ```

-   `project_id`: (Optional) ID of the Google Cloud project in which to deploy
    the service. The default value is computed from the environment.

-   `region`: (Optional) Region in which to deploy the service. The default
    value is `us-central1`.

-   `gcloud_version`: (Optional) Version of the `gcloud` CLI to use. The default
    value is `latest`.

-   `gcloud_component`: (Optional) Component of the `gcloud` CLI to use. Valid
    values are `alpha` and `beta`.


### Custom metadata YAML

For advanced use cases, you can define a custom Cloud Run metadata file. This is
a YAML description of the Cloud Run service. This allows you to customize your
service configuration, such as [memory
limits](https://cloud.google.com/run/docs/configuring/memory-limits), [CPU
allocation](https://cloud.google.com/run/docs/configuring/cpu), [max
instances](https://cloud.google.com/run/docs/configuring/max-instances), and
[more](https://cloud.google.com/sdk/gcloud/reference/run/deploy#OPTIONAL-FLAGS).

**⚠️ When using a custom metadata YAML file, all other inputs are ignored!**

-   `metadata`: (Optional) The path to a Cloud Run service metadata file.

To [deploying a new service](https://cloud.google.com/run/docs/deploying#yaml)
to create a new YAML service definition:

```yaml
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

To update a revision or to [deploy a new revision of an existing service](https://cloud.google.com/run/docs/deploying#yaml_1), download and modify the YAML service definition:

```shell
gcloud run services describe SERVICE --format yaml > service.yaml
```

## Allowing unauthenticated requests

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
