/*
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { mock, test } from 'node:test';
import assert, { AssertionError } from 'node:assert';

import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as setupGcloud from '@google-github-actions/setup-cloud-sdk';
import { TestToolCache } from '@google-github-actions/setup-cloud-sdk';

import { assertMembers } from '@google-github-actions/actions-utils';

import { run } from '../../src/main';

const fakeInputs: { [key: string]: string } = {
  image: 'gcr.io/cloudrun/hello',
  project_id: 'test',
};

const defaultMocks = (
  m: typeof mock,
  overrideInputs?: Record<string, string>,
): Record<string, any> => {
  const inputs = Object.assign({}, fakeInputs, overrideInputs);
  return {
    setFailed: m.method(core, 'setFailed', (msg: string) => {
      throw new Error(msg);
    }),
    getBooleanInput: m.method(core, 'getBooleanInput', (name: string) => {
      return !!inputs[name];
    }),
    getMultilineInput: m.method(core, 'getMultilineInput', (name: string) => {
      return inputs[name];
    }),
    getInput: m.method(core, 'getInput', (name: string) => {
      return inputs[name];
    }),
    getExecOutput: m.method(exec, 'getExecOutput', () => {
      return { exitCode: 0, stderr: '', stdout: '{}' };
    }),

    authenticateGcloudSDK: m.method(setupGcloud, 'authenticateGcloudSDK', () => {}),
    isAuthenticated: m.method(setupGcloud, 'isAuthenticated', () => {}),
    isInstalled: m.method(setupGcloud, 'isInstalled', () => {
      return true;
    }),
    installGcloudSDK: m.method(setupGcloud, 'installGcloudSDK', async () => {
      return '1.2.3';
    }),
    installComponent: m.method(setupGcloud, 'installComponent', () => {}),
    setProject: m.method(setupGcloud, 'setProject', () => {}),
    getLatestGcloudSDKVersion: m.method(setupGcloud, 'getLatestGcloudSDKVersion', () => {
      return '1.2.3';
    }),
  };
};

const assertEscapedArgument = (args: string[], param: string, expected: string[]) => {
  let found = false;
  let i = 0;
  for (; i < args.length; i += 1) {
    if (args[i] === param) {
      found = true;
      break;
    }
  }
  assert.ok(found, `could not find param ${param} in args`);

  const actualEscaped = args[i + 1];
  assert.ok(actualEscaped, `missing values after param ${param}`);

  assert.deepStrictEqual(actualEscaped.charAt(0), '^');
  const separator = actualEscaped.charAt(1);
  assert.deepStrictEqual(actualEscaped.charAt(2), '^');
  const actual = actualEscaped.substring(3).split(separator);
  assert.deepStrictEqual(actual, expected, `values for param ${param} differ`);
};

test('#run', { concurrency: true }, async (suite) => {
  const originalEnv = Object.assign({}, process.env);

  suite.before(() => {
    suite.mock.method(core, 'debug', () => {});
    suite.mock.method(core, 'info', () => {});
    suite.mock.method(core, 'warning', () => {});
    suite.mock.method(core, 'setOutput', () => {});
    suite.mock.method(core, 'setSecret', () => {});
    suite.mock.method(core, 'group', () => {});
    suite.mock.method(core, 'startGroup', () => {});
    suite.mock.method(core, 'endGroup', () => {});
    suite.mock.method(core, 'addPath', () => {});
    suite.mock.method(core, 'exportVariable', () => {});
  });

  suite.beforeEach(async () => {
    await TestToolCache.start();
  });

  suite.afterEach(async () => {
    process.env = originalEnv;
    await TestToolCache.stop();
  });

  await suite.test('sets the project ID', async (t) => {
    const mocks = defaultMocks(t.mock, {
      project_id: 'my-test-project',
      service: 'my-test-service',
    });
    await run();

    const args = mocks.getExecOutput.mock.calls?.at(0).arguments?.at(1);
    assertMembers(args, ['--project', 'my-test-project']);
  });

  await suite.test('sets a single region', async (t) => {
    const mocks = defaultMocks(t.mock, {
      region: 'us-central1',
      service: 'my-test-service',
    });
    await run();

    const args = mocks.getExecOutput.mock.calls?.at(0).arguments?.at(1);
    assertMembers(args, ['--region', 'us-central1']);
  });

  await suite.test('sets a multiple regions', async (t) => {
    const mocks = defaultMocks(t.mock, {
      region: 'us-central1,  us-east1',
      service: 'my-test-service',
    });
    await run();

    const args = mocks.getExecOutput.mock.calls?.at(0).arguments?.at(1);
    assertMembers(args, ['--region', 'us-central1,us-east1']);
  });

  await suite.test('installs the gcloud SDK if it is not already installed', async (t) => {
    const mocks = defaultMocks(t.mock, {
      service: 'my-test-service',
    });
    t.mock.method(setupGcloud, 'isInstalled', () => {
      return false;
    });

    await run();

    assert.deepStrictEqual(mocks.installGcloudSDK.mock.callCount(), 1);
  });

  await suite.test('uses the cached gcloud SDK if it was already installed', async (t) => {
    const mocks = defaultMocks(t.mock, {
      service: 'my-test-service',
    });
    t.mock.method(setupGcloud, 'isInstalled', () => {
      return true;
    });

    await run();

    assert.deepStrictEqual(mocks.installGcloudSDK.mock.callCount(), 0);
  });

  await suite.test('uses default components without gcloud_component flag', async (t) => {
    const mocks = defaultMocks(t.mock, {
      service: 'my-test-service',
    });

    await run();

    assert.deepStrictEqual(mocks.installComponent.mock.callCount(), 0);
  });

  await suite.test('throws error with invalid gcloud component flag', async (t) => {
    defaultMocks(t.mock, {
      service: 'my-test-service',
      gcloud_component: 'wrong_value',
    });

    await assert.rejects(
      async () => {
        await run();
      },
      { message: /invalid input received for gcloud_component: wrong_value/ },
    );
  });

  await suite.test('installs alpha component with alpha flag', async (t) => {
    const mocks = defaultMocks(t.mock, {
      service: 'my-test-service',
      gcloud_component: 'alpha',
    });

    await run();

    const args = mocks.installComponent.mock.calls?.at(0).arguments?.at(0);
    assert.deepStrictEqual(args, 'alpha');
  });

  await suite.test('installs alpha component with beta flag', async (t) => {
    const mocks = defaultMocks(t.mock, {
      service: 'my-test-service',
      gcloud_component: 'beta',
    });

    await run();

    const args = mocks.installComponent.mock.calls?.at(0).arguments?.at(0);
    assert.deepStrictEqual(args, 'beta');
  });

  await suite.test('sets labels', async (t) => {
    const mocks = defaultMocks(t.mock, {
      service: 'my-test-service',
      labels: 'foo=bar,zip=zap',
    });

    process.env.GITHUB_SHA = 'abcdef123456';

    await run();

    const expectedLabels = {
      'managed-by': 'github-actions',
      'commit-sha': 'abcdef123456',
      'foo': 'bar',
      'zip': 'zap',
    };
    const args = mocks.getExecOutput.mock.calls?.at(0).arguments?.at(1);
    const labels = splitKV(args.at(args.indexOf('--update-labels') + 1));
    assert.deepStrictEqual(labels, expectedLabels);
  });

  await suite.test('skips default labels', async (t) => {
    const mocks = defaultMocks(t.mock, {
      service: 'my-test-service',
      skip_default_labels: 'true',
      labels: 'foo=bar,zip=zap',
    });

    await run();

    const expectedLabels = {
      foo: 'bar',
      zip: 'zap',
    };
    const args = mocks.getExecOutput.mock.calls?.at(0).arguments?.at(1);
    const labels = splitKV(args.at(args.indexOf('--update-labels') + 1));
    assert.deepStrictEqual(labels, expectedLabels);
  });

  await suite.test('overwrites default labels', async (t) => {
    const mocks = defaultMocks(t.mock, {
      service: 'my-test-service',
      labels: 'commit-sha=custom-value',
    });
    process.env.GITHUB_SHA = 'abcdef123456';

    await run();

    const expectedLabels = {
      'managed-by': 'github-actions',
      'commit-sha': 'custom-value',
    };
    const args = mocks.getExecOutput.mock.calls?.at(0).arguments?.at(1);
    const labels = splitKV(args.at(args.indexOf('--update-labels') + 1));
    assert.deepStrictEqual(labels, expectedLabels);
  });

  await suite.test('sets source if given', async (t) => {
    const mocks = defaultMocks(t.mock, {
      service: 'my-test-service',
      source: 'example-app',
      image: '',
    });

    await run();

    const args = mocks.getExecOutput.mock.calls?.at(0).arguments?.at(1);
    assertMembers(args, ['--source', 'example-app']);
  });

  await suite.test('sets service metadata if given', async (t) => {
    const mocks = defaultMocks(t.mock, {
      metadata: 'tests/fixtures/service.yaml',
      image: '',
    });

    await run();

    const args = mocks.getExecOutput.mock.calls?.at(0).arguments?.at(1);
    assertMembers(args, ['services', 'replace']);
  });

  await suite.test('sets job metadata if given', async (t) => {
    const mocks = defaultMocks(t.mock, {
      metadata: 'tests/fixtures/job.yaml',
      image: '',
    });

    await run();

    const args = mocks.getExecOutput.mock.calls?.at(0).arguments?.at(1);
    assertMembers(args, ['jobs', 'replace']);
  });

  await suite.test('sets timeout if given', async (t) => {
    const mocks = defaultMocks(t.mock, {
      service: 'my-test-service',
      timeout: '55m12s',
    });

    await run();

    const args = mocks.getExecOutput.mock.calls?.at(0).arguments?.at(1);
    assertMembers(args, ['--timeout', '55m12s']);
  });

  await suite.test('sets tag if given', async (t) => {
    const mocks = defaultMocks(t.mock, {
      service: 'my-test-service',
      tag: 'test',
    });

    await run();

    const args = mocks.getExecOutput.mock.calls?.at(0).arguments?.at(1);
    assertMembers(args, ['--tag', 'test']);
  });

  await suite.test('sets tag traffic if given', async (t) => {
    const mocks = defaultMocks(t.mock, {
      service: 'my-test-service',
      tag: 'test',
    });

    await run();

    const args = mocks.getExecOutput.mock.calls?.at(0).arguments?.at(1);
    assertMembers(args, ['--tag', 'test']);
  });

  await suite.test('sets env vars if given', async (t) => {
    const mocks = defaultMocks(t.mock, {
      service: 'my-test-service',
      env_vars: 'FOO=BAR\nZIP=ZAP',
    });

    await run();

    const args = mocks.getExecOutput.mock.calls?.at(0).arguments?.at(1);
    assertEscapedArgument(args, '--update-env-vars', ['FOO=BAR', 'ZIP=ZAP']);
  });

  await suite.test('replaces env vars if given', async (t) => {
    const mocks = defaultMocks(t.mock, {
      service: 'my-test-service',
      env_vars: 'FOO=BAR\nZIP=ZAP',
      replace_env_vars: 'true',
    });

    await run();

    const args = mocks.getExecOutput.mock.calls?.at(0).arguments?.at(1);
    assertEscapedArgument(args, '--set-env-vars', ['FOO=BAR', 'ZIP=ZAP']);
  });

  await suite.test('sets secret env vars if given', async (t) => {
    const mocks = defaultMocks(t.mock, {
      service: 'my-test-service',
      secrets: 'FOO=BAR:latest\nZIP=ZAP:latest',
    });

    await run();

    const args = mocks.getExecOutput.mock.calls?.at(0).arguments?.at(1);
    assertEscapedArgument(args, '--update-secrets', ['FOO=BAR:latest', 'ZIP=ZAP:latest']);
  });

  await suite.test('replaces secret env vars if given', async (t) => {
    const mocks = defaultMocks(t.mock, {
      service: 'my-test-service',
      secrets: 'FOO=BAR:latest\nZIP=ZAP:latest',
      replace_secrets: 'true',
    });

    await run();

    const args = mocks.getExecOutput.mock.calls?.at(0).arguments?.at(1);
    assertEscapedArgument(args, '--set-secrets', ['FOO=BAR:latest', 'ZIP=ZAP:latest']);
  });

  await suite.test('fails if tag traffic and revision traffic are provided', async (t) => {
    defaultMocks(t.mock, {
      service: 'my-test-service',
      revision_traffic: 'TEST=100',
      tag_traffic: 'TEST=100',
    });

    await assert.rejects(
      async () => {
        await run();
      },
      { message: /only one of `revision_traffic` or `tag_traffic` inputs can be set/ },
    );
  });

  await suite.test('fails if service is not provided with tag traffic', async (t) => {
    defaultMocks(t.mock, {
      service: '',
      tag_traffic: 'TEST=100',
    });

    await assert.rejects(
      async () => {
        await run();
      },
      { message: /no service name set/ },
    );
  });

  await suite.test('fails if service is not provided with revision traffic', async (t) => {
    defaultMocks(t.mock, {
      service: '',
      revision_traffic: 'TEST=100',
    });

    await assert.rejects(
      async () => {
        await run();
      },
      { message: /no service name set/ },
    );
  });

  await suite.test('fails if job and service are both specified', async (t) => {
    defaultMocks(t.mock, {
      service: 'my-test-service',
      job: 'my-test-job',
    });

    await assert.rejects(
      async () => {
        await run();
      },
      { message: /only one of `service` or `job` inputs can be set/ },
    );
  });

  await suite.test('deploys a job if job is specified', async (t) => {
    const mocks = defaultMocks(t.mock, {
      job: 'my-test-job',
    });

    await run();

    const args = mocks.getExecOutput.mock.calls?.at(0).arguments?.at(1);
    assertMembers(args, ['run', 'jobs', 'deploy', 'my-test-job']);
  });
});

const splitKV = (s: string): Record<string, string> => {
  const delim = s.match(/\^(.+)\^/i);
  if (!delim || delim.length === 0) {
    throw new Error(`Invalid delimiter: ${s}`);
  }

  const parts = s.slice(delim[0].length).split(delim[1]);
  return Object.fromEntries(parts.map((p) => p.split('=')));
};
