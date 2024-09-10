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

<!-- BEGIN_AUTOGEN_INPUTS -->

-   <a name="service"></a><a href="#user-content-service"><code>service</code></a>: _(Optional)_ ID of the service or fully-qualified identifier of the service. This is
    required unless providing `metadata` or `job`.

-   <a name="job"></a><a href="#user-content-job"><code>job</code></a>: _(Optional)_ ID of the job or fully-qualified identifier of the job. This is required
    unless providing `metadata` or `service`.

-   <a name="metadata"></a><a href="#user-content-metadata"><code>metadata</code></a>: _(Optional)_ YAML service description for the Cloud Run service. This is required
    unless providing `service` or `job`.

-   <a name="image"></a><a href="#user-content-image"><code>image</code></a>: _(Optional)_ (Required, unless providing `metadata` or `source`) Fully-qualified name
    of the container image to deploy. For example:

        gcr.io/cloudrun/hello:latest

    or

        us-docker.pkg.dev/my-project/my-container/image:1.2.3

-   <a name="source"></a><a href="#user-content-source"><code>source</code></a>: _(Optional)_ (Required, unless providing `metadata`, `image`, or `job`) Path to source
    to deploy. If specified, this will deploy the Cloud Run service from the
    code specified at the given source directory.

    Learn more about the required permissions in [Deploying from source
    code](https://cloud.google.com/run/docs/deploying-source-code).

-   <a name="suffix"></a><a href="#user-content-suffix"><code>suffix</code></a>: _(Optional)_ String suffix to append to the revision name. Revision names always start
    with the service name automatically. For example, specifying `v1` for a
    service named `helloworld`, would lead to a revision named
    `helloworld-v1`. This option is only applies to services.

-   <a name="env_vars"></a><a href="#user-content-env_vars"><code>env_vars</code></a>: _(Optional)_ List of environment variables that should be set in the environment.
    These are comma-separated or newline-separated `KEY=VALUE`. Keys or values
    that contain separators must be escaped with a backslash (e.g. `\,` or
    `\\n`) unless quoted. Any leading or trailing whitespace is trimmed unless
    values are quoted.

        env_vars: |-
          FRUIT=apple
          SENTENCE=" this will retain leading and trailing spaces "

    This value will only be set if the input is a non-empty value. If a
    non-empty value is given, the field values will be overwritten (not
    merged). To remove all values, set the value to the literal string `{}`.

    If both `env_vars` and `env_vars_file` are specified, the keys in
    `env_vars` will take precendence over the keys in `env_vars_file`.

-   <a name="env_vars_file"></a><a href="#user-content-env_vars_file"><code>env_vars_file</code></a>: _(Optional)_ Path to a file on disk, relative to the workspace, that defines
    environment variables. The file can be newline-separated KEY=VALUE pairs,
    JSON, or YAML format. If both `env_vars` and `env_vars_file` are
    specified, the keys in env_vars will take precendence over the keys in
    env_vars_file.

        NAME=person
        EMAILS=foo@bar.com\,zip@zap.com

    When specified as KEY=VALUE pairs, the same escaping rules apply as
    described in `env_vars`. You do not have to escape YAML or JSON.

    If both `env_vars` and `env_vars_file` are specified, the keys in
    `env_vars` will take precendence over the keys in `env_vars_file`.

    **⚠️ DEPRECATION NOTICE:** This input is deprecated and will be removed in
    the next major version release.

-   <a name="env_vars_update_strategy"></a><a href="#user-content-env_vars_update_strategy"><code>env_vars_update_strategy</code></a>: _(Required, default: `merge`)_ Controls how the environment variables are set on the Cloud Run service.
    If set to "merge", then the environment variables are _merged_ with any
    upstream values. If set to "overwrite", then all environment variables on
    the Cloud Run service will be replaced with exactly the values given by
    the GitHub Action (making it authoritative).

-   <a name="secrets"></a><a href="#user-content-secrets"><code>secrets</code></a>: _(Optional)_ List of KEY=VALUE pairs to use as secrets. These are comma-separated or
    newline-separated `KEY=VALUE`. Keys or values that contain separators must
    be escaped with a backslash (e.g. `\,` or `\\n`) unless quoted. Any
    leading or trailing whitespace is trimmed unless values are quoted.

    These can either be injected as environment variables or mounted as
    volumes. Keys starting with a forward slash '/' are mount paths. All other
    keys correspond to environment variables:

        with:
          secrets: |-
            # As an environment variable:
            KEY1=secret-key-1:latest

            # As a volume mount:
            /secrets/api/key=secret-key-2:latest

    This value will only be set if the input is a non-empty value. If a
    non-empty value is given, the field values will be overwritten (not
    merged). To remove all values, set the value to the literal string `{}`.

-   <a name="secrets_update_strategy"></a><a href="#user-content-secrets_update_strategy"><code>secrets_update_strategy</code></a>: _(Required, default: `merge`)_ Controls how the secrets are set on the Cloud Run service. If set to
    `merge`, then the secrets are merged with any upstream values. If set to
    `overwrite`, then all secrets on the Cloud Run service will be replaced
    with exactly the values given by the GitHub Action (making it
    authoritative).

-   <a name="labels"></a><a href="#user-content-labels"><code>labels</code></a>: _(Optional)_ List of labels that should be set on the function. These are
    comma-separated or newline-separated `KEY=VALUE`. Keys or values that
    contain separators must be escaped with a backslash (e.g. `\,` or `\\n`)
    unless quoted. Any leading or trailing whitespace is trimmed unless values
    are quoted.

        labels: |-
          labela=my-label
          labelb=my-other-label

    This value will only be set if the input is a non-empty value. If a
    non-empty value is given, the field values will be overwritten (not
    merged). To remove all values, set the value to the literal string `{}`.

    Google Cloud restricts the allowed values and length for labels. Please
    see the Google Cloud documentation for labels for more information.

-   <a name="skip_default_labels"></a><a href="#user-content-skip_default_labels"><code>skip_default_labels</code></a>: _(Optional, default: `false`)_ Skip applying the special annotation labels that indicate the deployment
    came from GitHub Actions. The GitHub Action will automatically apply the
    following labels which Cloud Run uses to enhance the user experience:

        managed-by: github-actions
        commit-sha: <sha>

    Setting this to `true` will skip adding these special labels.

-   <a name="tag"></a><a href="#user-content-tag"><code>tag</code></a>: _(Optional)_ Traffic tag to assign to the newly-created revision. This option is only
    applies to services.

-   <a name="timeout"></a><a href="#user-content-timeout"><code>timeout</code></a>: _(Optional)_ Maximum request execution time, specified as a duration like "10m5s" for
    ten minutes and 5 seconds.

-   <a name="flags"></a><a href="#user-content-flags"><code>flags</code></a>: _(Optional)_ Space separate list of additional Cloud Run flags to pass to the deploy
    command. This can be used to apply advanced features that are not exposed
    via this GitHub Action. For Cloud Run services, this command will be
    `gcloud run deploy`. For Cloud Run jobs, this command will be `gcloud jobs
    deploy.

        with:
          flags: '--add-cloudsql-instances=...'

    Flags that include other flags must quote the _entire_ outer flag value. For
    example, to pass `--args=-X=123`:

        with:
          flags: '--add-cloudsql-instances=... "--args=-X=123"'

    See the [complete list of
    flags](https://cloud.google.com/sdk/gcloud/reference/run/deploy#FLAGS) for
    more information.

    Please note, this GitHub Action does not parse or validate the flags. You
    are responsible for making sure the flags are available on the gcloud
    version and subcommand.

-   <a name="no_traffic"></a><a href="#user-content-no_traffic"><code>no_traffic</code></a>: _(Optional, default: `false`)_ If true, the newly deployed revision will not receive traffic. This option
    is only applies to services.

-   <a name="revision_traffic"></a><a href="#user-content-revision_traffic"><code>revision_traffic</code></a>: _(Optional)_ Comma-separated list of revision traffic assignments.

        with:
          revision_traffic: 'my-revision=10' # percentage

    To update traffic to the latest revision, use the special tag "LATEST":

        with:
          revision_traffic: 'LATEST=100'

    This is mutually-exclusive with `tag_traffic`. This option is only applies
    to services.

-   <a name="tag_traffic"></a><a href="#user-content-tag_traffic"><code>tag_traffic</code></a>: _(Optional)_ Comma-separated list of tag traffic assignments.

        with:
          tag_traffic: 'my-tag=10' # percentage

    This is mutually-exclusive with `revision_traffic`. This option is only
    applies to services.

-   <a name="update_traffic_flags"></a><a href="#user-content-update_traffic_flags"><code>update_traffic_flags</code></a>: _(Optional)_ Space separate list of additional Cloud Run flags to pass to the `gcloud
    run services update-traffic` command. This can be used to apply advanced
    features that are not exposed via this GitHub Action. This flag only
    applies with `revision_traffic` or `tag_traffic` is set.

        with:
          traffic_flags: '--set-tags=...'

    Flags that include other flags must quote the _entire_ outer flag value. For
    example, to pass `--args=-X=123`:

        with:
          flags: '--set-tags=... "--args=-X=123"'

    See the [complete list of
    flags](https://cloud.google.com/sdk/gcloud/reference/run/services/update#FLAGS)
    for more information.

    Please note, this GitHub Action does not parse or validate the flags. You
    are responsible for making sure the flags are available on the gcloud
    version and subcommand.

-   <a name="project_id"></a><a href="#user-content-project_id"><code>project_id</code></a>: _(Optional)_ ID of the Google Cloud project in which to deploy the service.

-   <a name="region"></a><a href="#user-content-region"><code>region</code></a>: _(Optional, default: `us-central1`)_ Region in which the Cloud Run services are deployed.

-   <a name="gcloud_version"></a><a href="#user-content-gcloud_version"><code>gcloud_version</code></a>: _(Optional)_ Version of the Cloud SDK to install. If unspecified or set to "latest",
    the latest available gcloud SDK version for the target platform will be
    installed. Example: "290.0.1".

-   <a name="gcloud_component"></a><a href="#user-content-gcloud_component"><code>gcloud_component</code></a>: _(Optional)_ Version of the Cloud SDK components to install and use.


<!-- END_AUTOGEN_INPUTS -->

### Custom metadata YAML

For advanced use cases, you can define a custom Cloud Run metadata file. This is
a YAML description of the Cloud Run service or job. This allows you to customize your
service configuration, such as [memory
limits](https://cloud.google.com/run/docs/configuring/memory-limits), [CPU
allocation](https://cloud.google.com/run/docs/configuring/cpu), [max
instances](https://cloud.google.com/run/docs/configuring/max-instances), and
[more](https://cloud.google.com/sdk/gcloud/reference/run/deploy#OPTIONAL-FLAGS).

**⚠️ When using a custom metadata YAML file, all other inputs are ignored!**

-   `metadata`: (Optional) The path to a Cloud Run service or job metadata file.

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

<!-- BEGIN_AUTOGEN_OUTPUTS -->

-   `url`: The URL of the Cloud Run service.


<!-- END_AUTOGEN_OUTPUTS -->


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
[artifact-api]: https://console.cloud.google.com/flows/enableapi?apiid=artifactregistry.googleapis.com
[repo]: https://cloud.google.com/artifact-registry/docs/manage-repos
