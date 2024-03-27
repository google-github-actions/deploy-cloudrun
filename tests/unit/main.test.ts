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
import assert from 'node:assert';

import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as setupGcloud from '@google-github-actions/setup-cloud-sdk';
import { TestToolCache } from '@google-github-actions/setup-cloud-sdk';

import { assertMembers } from '@google-github-actions/actions-utils';

import { run, kvToString } from '../../src/main';

const fakeInputs: { [key: string]: string } = {
  image: 'gcr.io/cloudrun/hello',
  service: 'test',
  job: '',
  metadata: '',
  project_id: 'test',
  env_vars: '',
  env_vars_file: '',
  labels: '',
  skip_default_labels: 'false',
  source: '',
  suffix: '',
  tag: '',
  timeout: '',
  revision_traffic: '',
  tag_traffic: '',
};

const fakeInputsJob: { [key: string]: string } = {
  image: 'gcr.io/cloudrun/hello',
  job: 'job-name',
  metadata: '',
  project_id: 'test',
  env_vars: '',
  env_vars_file: '',
  labels: '',
  skip_default_labels: 'false',
  source: '',
  suffix: '',
  tag: '',
  timeout: '',
  revision_traffic: '',
  tag_traffic: '',
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

const jobMocks = (m: typeof mock, overrideInputs?: Record<string, string>): Record<string, any> => {
  const inputs = Object.assign({}, fakeInputsJob, overrideInputs);
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
      project_id: 'test',
    });
    await run();

    const args = mocks.getExecOutput.mock.calls?.at(0).arguments?.at(1);
    assertMembers(args, ['--project', 'test']);
  });

  await suite.test('installs the gcloud SDK if it is not already installed', async (t) => {
    const mocks = defaultMocks(t.mock);
    t.mock.method(setupGcloud, 'isInstalled', () => {
      return false;
    });

    await run();

    assert.deepStrictEqual(mocks.installGcloudSDK.mock.callCount(), 1);
  });

  await suite.test('uses the cached gcloud SDK if it was already installed', async (t) => {
    const mocks = defaultMocks(t.mock);
    t.mock.method(setupGcloud, 'isInstalled', () => {
      return true;
    });

    await run();

    assert.deepStrictEqual(mocks.installGcloudSDK.mock.callCount(), 0);
  });

  await suite.test('uses default components without gcloud_component flag', async (t) => {
    const mocks = defaultMocks(t.mock);

    await run();

    assert.deepStrictEqual(mocks.installComponent.mock.callCount(), 0);
  });

  await suite.test('throws error with invalid gcloud component flag', async (t) => {
    defaultMocks(t.mock, {
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
      gcloud_component: 'alpha',
    });

    await run();

    const args = mocks.installComponent.mock.calls?.at(0).arguments?.at(0);
    assert.deepStrictEqual(args, 'alpha');
  });

  await suite.test('installs alpha component with beta flag', async (t) => {
    const mocks = defaultMocks(t.mock, {
      gcloud_component: 'beta',
    });

    await run();

    const args = mocks.installComponent.mock.calls?.at(0).arguments?.at(0);
    assert.deepStrictEqual(args, 'beta');
  });

  await suite.test('sets labels', async (t) => {
    const mocks = defaultMocks(t.mock, {
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
    assertMembers(args, ['--update-labels', kvToString(expectedLabels)]);
  });

  await suite.test('skips default labels', async (t) => {
    const mocks = defaultMocks(t.mock, {
      skip_default_labels: 'true',
      labels: 'foo=bar,zip=zap',
    });

    await run();

    const expectedLabels = {
      foo: 'bar',
      zip: 'zap',
    };
    const args = mocks.getExecOutput.mock.calls?.at(0).arguments?.at(1);
    assertMembers(args, ['--update-labels', kvToString(expectedLabels)]);
  });

  await suite.test('overwrites default labels', async (t) => {
    const mocks = defaultMocks(t.mock, {
      labels: 'commit-sha=custom-value',
    });
    process.env.GITHUB_SHA = 'abcdef123456';

    await run();

    const expectedLabels = {
      'managed-by': 'github-actions',
      'commit-sha': 'custom-value',
    };
    const args = mocks.getExecOutput.mock.calls?.at(0).arguments?.at(1);
    assertMembers(args, ['--update-labels', kvToString(expectedLabels)]);
  });

  await suite.test('sets source if given', async (t) => {
    const mocks = defaultMocks(t.mock, {
      source: 'example-app',
      image: '',
    });

    await run();

    const args = mocks.getExecOutput.mock.calls?.at(0).arguments?.at(1);
    assertMembers(args, ['--source', 'example-app']);
  });

  await suite.test('sets metadata if given', async (t) => {
    const mocks = defaultMocks(t.mock, {
      metadata: 'yaml',
      image: '',
      service: '',
    });

    await run();

    const args = mocks.getExecOutput.mock.calls?.at(0).arguments?.at(1);
    assertMembers(args, ['services', 'replace', 'yaml']);
  });

  await suite.test('sets timeout if given', async (t) => {
    const mocks = defaultMocks(t.mock, {
      timeout: '55m12s',
    });

    await run();

    const args = mocks.getExecOutput.mock.calls?.at(0).arguments?.at(1);
    assertMembers(args, ['--timeout', '55m12s']);
  });

  await suite.test('sets tag if given', async (t) => {
    const mocks = defaultMocks(t.mock, {
      tag: 'test',
    });

    await run();

    const args = mocks.getExecOutput.mock.calls?.at(0).arguments?.at(1);
    assertMembers(args, ['--tag', 'test']);
  });

  await suite.test('sets tag traffic if given', async (t) => {
    const mocks = defaultMocks(t.mock, {
      tag: 'test',
      service: 'service-name',
    });

    await run();

    const args = mocks.getExecOutput.mock.calls?.at(0).arguments?.at(1);
    assertMembers(args, ['--tag', 'test']);
  });

  await suite.test('fails if tag traffic and revision traffic are provided', async (t) => {
    defaultMocks(t.mock, {
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

  await suite.test('fails if name is not provided with tag traffic', async (t) => {
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

  await suite.test('fails if name is not provided with revision traffic', async (t) => {
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

  await suite.test('ignore job if job and service are both specified', async (t) => {
    const mocks = defaultMocks(t.mock, {
      service: 'test',
      job: 'job-name',
    });

    await run();

    const args = mocks.getExecOutput.mock.calls?.at(0).arguments?.at(1);
    assertMembers(args, ['run', 'deploy', 'test']);
  });

  await suite.test('updates a job if job is specified and service is not', async (t) => {
    const mocks = jobMocks(t.mock);

    await run();

    const args = mocks.getExecOutput.mock.calls?.at(0).arguments?.at(1);
    assertMembers(args, ['run', 'jobs', 'update', 'job-name']);
  });

  await suite.test(
    'updates a job if job is specified and service is an empty string',
    async (t) => {
      const mocks = defaultMocks(t.mock, {
        service: '',
        job: 'job-name',
      });

      await run();

      const args = mocks.getExecOutput.mock.calls?.at(0).arguments?.at(1);
      assertMembers(args, ['run', 'jobs', 'update', 'job-name']);
    },
  );
});

test('#kvToString', { concurrency: true }, async (suite) => {
  const cases = [
    {
      name: `empty`,
      input: {},
      expected: ``,
    },
    {
      name: `single item`,
      input: { FOO: 'bar' },
      expected: `FOO=bar`,
    },
    {
      name: `multiple items`,
      input: { FOO: 'bar', ZIP: 'zap' },
      expected: `FOO=bar,ZIP=zap`,
    },
  ];

  for await (const tc of cases) {
    await suite.test(tc.name, async () => {
      const result = kvToString(tc.input as Record<string, string>);
      assert.deepStrictEqual(result, tc.expected);
    });
  }
});
