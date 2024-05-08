# deploy-cloudrun

The `deploy-cloudrun` GitHub Action deploys to Google [Cloud Run][cloud-run]. It
can deploy a container image or from source, and the resulting service URL is
available as a GitHub Actions output for use in future steps.

**This is not an officially supported Google product, and it is not covered by a
Google Cloud support contract. To report bugs or request features in a Google
Cloud product, please contact [Google Cloud
support](https://cloud.google.com/support).**


## Prerequisites

-   This action requires Google Cloud credentials that are authorized to access
    the secrets being requested. See [Authorization](#authorization) for more
    information.

-   This action runs using Node 20. If you are using self-hosted GitHub Actions
    runners, you must use a [runner
    version](https://github.com/actions/virtual-environments) that supports this
    version or newer.


## Usage

```yaml
jobs:
  job_id:
    # ...

    permissions:
      contents: 'read'
      id-token: 'write'

    steps:
    - uses: 'actions/checkout@v4'

    - uses: 'google-github-actions/auth@v2'
      with:
        workload_identity_provider: 'projects/123456789/locations/global/workloadIdentityPools/my-pool/providers/my-provider'
        service_account: 'my-service-account@my-project.iam.gserviceaccount.com'

    - id: 'deploy'
      uses: 'google-github-actions/deploy-cloudrun@v2'
      with:
        service: 'hello-cloud-run'
        image: 'gcr.io/cloudrun/hello'

    - name: 'Use output'
      run: 'curl "${{ steps.deploy.outputs.url }}"'
```

## Inputs

-   `service`: (Required, unless providing `metadata` or `job`) ID of the
    service or fully-qualified identifier of the service. Only one of `service`
    or `job` may be specified.

-   `job`: (Required, unless providing `metadata` or `service`) ID of the job or
    fully-qualified identifier of the job. Only one of `service` or `job` may be
    specified.

-   `image`: (Required, unless providing `metadata` or `source`) Fully-qualified
    name of the container image to deploy. For example:

    ```text
    gcr.io/cloudrun/hello:latest
    ```

    or

    ```text
    us-docker.pkg.dev/my-project/my-container/image:1.2.3
    ```

-   `source`: (Required, unless providing `metadata`, `image`, or `job`) Path to
    source to deploy. If specified, this will deploy the Cloud Run service from
    the code specified at the given source directory.

    This requires the [Artifact Registry API][artifact-api] to be enabled.
    Furthermore, the deploying service account must have the `Cloud Build
    Service Account` role. The initial deployment will create an [Artifact
    Registry repository][repo] which requires the `Artifact Registry Admin`
    role.

    Learn more about [Deploying from source
    code](https://cloud.google.com/run/docs/deploying-source-code).

-   `suffix`: (Optional) String suffix to append to the revision name. Revision
    names always start with the service name automatically. For example,
    specifying 'v1' for a service named 'helloworld', would lead to a revision
    named 'helloworld-v1'. The default value is no suffix.

-   `env_vars`: (Optional) List of key=value pairs to set as environment
    variables. All existing environment variables will be retained. If both
    `env_vars` and `env_vars_file` are specified, the keys in `env_vars` will take
    precendence over the keys in `env_vars_files`.

    ```yaml
    with:
      env_vars: |
        FOO=bar
        ZIP=zap
    ```

    Entries are separated by commas (`,`) and newline characters. Keys and
    values are separated by `=`. To use `,`, `=`, or newline characters, escape
    them with a backslash:

    ```yaml
    with:
      env_vars: |
        EMAILS=foo@bar.com\,zip@zap.com
    ```

-   `env_vars_file`: (Optional) Path to a file on disk, relative to the
    workspace, that defines environment variables. The file can be
    newline-separated KEY=VALUE pairs, JSON, or YAML format. If both `env_vars`
    and `env_vars_file` are specified, the keys in env_vars will take
    precendence over the keys in env_vars_files.

    ```text
    FOO=bar
    ZIP=zap
    ```

    or

    ```json
    {
      "FOO": "bar",
      "ZIP": "zap"
    }
    ```

    or

    ```yaml
    FOO: 'bar'
    ZIP: 'zap'
    ```

    When specified as KEY=VALUE pairs, the same escaping rules apply as
    described in `env_vars`. You do not have to escape YAML or JSON.

-   `secrets`: (Optional) List of key=value pairs to use as secrets. These can
    either be injected as environment variables or mounted as volumes. All
    existing environment secrets and volume mounts will be retained.

    ```yaml
    with:
      secrets: |-
        # As an environment variable:
        KEY1=secret-key-1:latest

        # As a volume mount:
        /secrets/api/key=secret-key-2:latest
    ```

    The same rules apply for escaping entries as from `env_vars`, but Cloud Run
    is more restrictive with allowed keys and names for secrets.

-   `labels`: (Optional) List of key=value pairs to set as labels on the Cloud
    Run service. Existing labels will be overwritten.

    ```yaml
    with:
      labels: |-
        my-label=my-value
    ```

    The same rules apply for escaping entries as from `env_vars`, but labels
    have strict naming and casing requirements. See [Requirements for
    labels](https://cloud.google.com/resource-manager/docs/creating-managing-labels#requirements)
    for more information.

-   `skip_default_labels`: (Optional) Skip applying the special annotation
    labels that indicate the deployment came from GitHub Actions. The GitHub
    Action will automatically apply the following labels which Cloud Run uses to
    enhance the user experience:

    ```text
    managed-by: github-actions
    commit-sha: <sha>
    ```

    Setting this to `true` will skip adding these special labels. The default
    value is `false`.

-   `tag`: (Optional) Traffic tag to assign to the newly-created revision.

-   `timeout`: (Optional) Maximum request execution time, specified as a
    duration like "10m5s" for ten minutes and 5 seconds.

-   `flags`: (Optional) Space separate list of other Cloud Run flags. This can
    be used to access features that are not exposed via this GitHub Action.

    ```yaml
    with:
      flags: '--add-cloudsql-instances=...'
    ```

    Flags that include other flags must quote the _entire_ outer flag value. For
    example, to pass `--args=-X=123`:

    ```yaml
    with:
      flags: '--add-cloudsql-instances=... "--args=-X=123"'
    ```

    See the [complete list of
    flags](https://cloud.google.com/sdk/gcloud/reference/run/deploy#FLAGS) for
    more information.

    Please note, this GitHub Action does not parse or validate the flags. You
    are responsible for making sure the flags are available on the gcloud
    version and subcommand. When using `tag_traffic` or `revision_traffic`, the
    subcommand is `gcloud run services update-traffic`. For all other values,
    the subcommand is `gcloud run deploy`.

-   `no_traffic`: (Optional) If true, the newly deployed revision will not
    receive traffic. The default value is false.

-   `revision_traffic`: (Optional, mutually-exclusive with `tag_traffic`)
    Comma-separated list of revision traffic assignments.

    ```yaml
    with:
      revision_traffic: 'my-revision=10' # percentage
    ```

    To update traffic to the latest revision, use the special tag "LATEST":

    ```yaml
    with:
      revision_traffic: 'LATEST=100'
    ```

-   `tag_traffic`: (Optional, mutually-exclusive with `revision_traffic`)
    Comma-separated list of tag traffic assignments.

    ```yaml
    with:
      tag_traffic: 'my-tag=10' # percentage
    ```

-   `project_id`: (Optional) ID of the Google Cloud project in which to deploy
    the service. The default value is computed from the environment.

-   `region`: (Optional) Regions in which the Cloud Run services are deployed.
      This can be a single region or a comma-separated list of regions. The
    default value is `us-central1`.

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


## Authorization

There are a few ways to authenticate this action. The caller must have
permissions to access the secrets being requested.

You will need to authenticate to Google Cloud as a service account with the
following roles:

-   Cloud Run Admin (`roles/run.admin`):
    -   Can create, update, and delete services.
    -   Can get and set IAM policies.

This service account needs to be a member of the `Compute Engine default service account`,
`(PROJECT_NUMBER-compute@developer.gserviceaccount.com)`, with role
`Service Account User`. To grant a user permissions for a service account, use
one of the methods found in [Configuring Ownership and access to a service account](https://cloud.google.com/iam/docs/granting-roles-to-service-accounts#granting_access_to_a_user_for_a_service_account).


### Via google-github-actions/auth

Use [google-github-actions/auth](https://github.com/google-github-actions/auth)
to authenticate the action. You can use [Workload Identity Federation][wif] or
traditional [Service Account Key JSON][sa] authentication.

```yaml
jobs:
  job_id:
    permissions:
      contents: 'read'
      id-token: 'write'

    steps:

    # ...

    - uses: 'google-github-actions/auth@v2'
      with:
        workload_identity_provider: 'projects/123456789/locations/global/workloadIdentityPools/my-pool/providers/my-provider'
        service_account: 'my-service-account@my-project.iam.gserviceaccount.com'

    - uses: 'google-github-actions/deploy-cloudrun@v2'
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
    # ...

    - uses: 'google-github-actions/deploy-cloudrun@v2'
      with:
        image: 'gcr.io/cloudrun/hello'
        service: 'hello-cloud-run'
```

The action will automatically detect and use the Application Default
Credentials.

## Example Workflows

* [Deploy from source](https://github.com/google-github-actions/example-workflows/blob/main/workflows/deploy-cloudrun/cloudrun-source.yml)

* [Build and deploy a container](https://github.com/google-github-actions/example-workflows/blob/main/workflows/deploy-cloudrun/cloudrun-docker.yml)


[cloud-run]: https://cloud.google.com/run
[sa]: https://cloud.google.com/iam/docs/creating-managing-service-accounts
[wif]: https://cloud.google.com/iam/docs/workload-identity-federation
[create-key]: https://cloud.google.com/iam/docs/creating-managing-service-account-keys
[gh-runners]: https://help.github.com/en/actions/hosting-your-own-runners/about-self-hosted-runners
[gh-secret]: https://help.github.com/en/actions/configuring-and-managing-workflows/creating-and-storing-encrypted-secrets
[setup-gcloud]: ./setup-gcloud
[artifact-api]: https://console.cloud.google.com/flows/enableapi?apiid=artifactregistry.googleapis.com&redirect=https://cloud.google.com/artifact-registry/docs/docker/quickstart
[repo]: https://cloud.google.com/artifact-registry/docs/manage-repos
