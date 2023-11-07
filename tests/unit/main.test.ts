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

import 'mocha';
import { expect } from 'chai';
import * as sinon from 'sinon';

import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as setupGcloud from '@google-github-actions/setup-cloud-sdk';
import { TestToolCache } from '@google-github-actions/setup-cloud-sdk';
import { errorMessage } from '@google-github-actions/actions-utils';

import { run, kvToString } from '../../src/main';

// These are mock data for github actions inputs, where camel case is expected.
const fakeInputs: { [key: string]: string } = {
  image: 'gcr.io/cloudrun/hello',
  service: 'test',
  job: '',
  metadata: '',
  project_id: 'my-test-project',
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

function getInputMock(name: string): string {
  return fakeInputs[name];
}

describe('#run', function () {
  beforeEach(async function () {
    await TestToolCache.start();

    this.stubs = {
      getInput: sinon.stub(core, 'getInput').callsFake(getInputMock),
      exportVariable: sinon.stub(core, 'exportVariable'),
      setOutput: sinon.stub(core, 'setOutput'),
      authenticateGcloudSDK: sinon.stub(setupGcloud, 'authenticateGcloudSDK'),
      getLatestGcloudSDKVersion: sinon
        .stub(setupGcloud, 'getLatestGcloudSDKVersion')
        .resolves('1.2.3'),
      isInstalled: sinon.stub(setupGcloud, 'isInstalled').returns(true),
      installGcloudSDK: sinon.stub(setupGcloud, 'installGcloudSDK'),
      installComponent: sinon.stub(setupGcloud, 'installComponent'),
      getExecOutput: sinon
        .stub(exec, 'getExecOutput')
        .resolves({ exitCode: 0, stderr: '', stdout: '{}' }),
    };

    sinon.stub(core, 'setFailed').throwsArg(0); // make setFailed throw exceptions
    sinon.stub(core, 'addPath').callsFake(sinon.fake());
    sinon.stub(core, 'debug').callsFake(sinon.fake());
    sinon.stub(core, 'endGroup').callsFake(sinon.fake());
    sinon.stub(core, 'info').callsFake(sinon.fake());
    sinon.stub(core, 'startGroup').callsFake(sinon.fake());
    sinon.stub(core, 'warning').callsFake(sinon.fake());
  });

  afterEach(async function () {
    Object.keys(this.stubs).forEach((k) => this.stubs[k].restore());
    sinon.restore();
    delete process.env.GITHUB_SHA;

    await TestToolCache.stop();
  });

  it('sets the project ID if provided', async function () {
    this.stubs.getInput.withArgs('project_id').returns('my-test-project');
    await run();

    const call = this.stubs.getExecOutput.getCall(0);
    expect(call).to.be;
    const args = call.args[1];
    expect(args).to.include.members(['--project', 'my-test-project']);
  });

  it('installs the gcloud SDK if it is not already installed', async function () {
    this.stubs.isInstalled.returns(false);
    await run();
    expect(this.stubs.installGcloudSDK.callCount).to.eq(1);
  });

  it('uses the cached gcloud SDK if it was already installed', async function () {
    this.stubs.isInstalled.returns(true);
    await run();
    expect(this.stubs.installGcloudSDK.callCount).to.eq(0);
  });

  it('sets labels', async function () {
    this.stubs.getInput.withArgs('labels').returns('foo=bar,zip=zap');

    process.env.GITHUB_SHA = 'abcdef123456';

    const expectedLabels = {
      'managed-by': 'github-actions',
      'commit-sha': 'abcdef123456',
      'foo': 'bar',
      'zip': 'zap',
    };

    await run();
    const call = this.stubs.getExecOutput.getCall(0);
    expect(call).to.be;
    const args = call.args[1];
    expect(args).to.include.members(['--update-labels', kvToString(expectedLabels)]);
  });

  it('skips default labels', async function () {
    this.stubs.getInput.withArgs('skip_default_labels').returns('true');
    this.stubs.getInput.withArgs('labels').returns('foo=bar,zip=zap');

    const expectedLabels = {
      foo: 'bar',
      zip: 'zap',
    };

    await run();
    const call = this.stubs.getExecOutput.getCall(0);
    expect(call).to.be;
    const args = call.args[1];
    expect(args).to.include.members(['--update-labels', kvToString(expectedLabels)]);
  });

  it('overwrites default labels', async function () {
    this.stubs.getInput.withArgs('labels').returns('commit-sha=custom-value');

    process.env.GITHUB_SHA = 'abcdef123456';

    const expectedLabels = {
      'managed-by': 'github-actions',
      'commit-sha': 'custom-value',
    };

    await run();
    const call = this.stubs.getExecOutput.getCall(0);
    expect(call).to.be;
    const args = call.args[1];
    expect(args).to.include.members(['--update-labels', kvToString(expectedLabels)]);
  });

  it('sets source if given', async function () {
    this.stubs.getInput.withArgs('source').returns('example-app');
    this.stubs.getInput.withArgs('image').returns('');
    await run();
    const call = this.stubs.getExecOutput.getCall(0);
    expect(call).to.be;
    const args = call.args[1];
    expect(args).to.include.members(['--source', 'example-app']);
  });

  it('sets metadata if given', async function () {
    this.stubs.getInput.withArgs('metadata').returns('yaml');
    this.stubs.getInput.withArgs('image').returns('');
    this.stubs.getInput.withArgs('service').returns('');
    await run();
    const call = this.stubs.getExecOutput.getCall(0);
    expect(call).to.be;
    const args = call.args[1];
    expect(args).to.include.members(['services', 'replace', 'yaml']);
  });

  it('sets timeout if given', async function () {
    this.stubs.getInput.withArgs('timeout').returns('55m12s');
    await run();
    const call = this.stubs.getExecOutput.getCall(0);
    expect(call).to.be;
    const args = call.args[1];
    expect(args).to.include.members(['--timeout', '55m12s']);
  });

  it('sets tag if given', async function () {
    this.stubs.getInput.withArgs('tag').returns('test');
    await run();
    const call = this.stubs.getExecOutput.getCall(0);
    expect(call).to.be;
    const args = call.args[1];
    expect(args).to.include.members(['--tag', 'test']);
  });

  it('sets tag traffic if given', async function () {
    this.stubs.getInput.withArgs('tag').returns('test');
    this.stubs.getInput.withArgs('service').returns('service-name');
    await run();
    const call = this.stubs.getExecOutput.getCall(0);
    expect(call).to.be;
    const args = call.args[1];
    expect(args).to.include.members(['--tag', 'test']);
  });

  it('fails if tag traffic and revision traffic are provided', async function () {
    this.stubs.getInput.withArgs('revision_traffic').returns('TEST=100');
    this.stubs.getInput.withArgs('tag_traffic').returns('TEST=100');
    expectError(run, 'only one of `revision_traffic` or `tag_traffic` inputs can be set');
  });

  it('fails if name is not provided with tag traffic', async function () {
    this.stubs.getInput.withArgs('tag_traffic').returns('TEST=100');
    this.stubs.getInput.withArgs('service').returns('');
    expectError(run, 'no service name set');
  });

  it('fails if name is not provided with revision traffic', async function () {
    this.stubs.getInput.withArgs('revision_traffic').returns('TEST=100');
    this.stubs.getInput.withArgs('service').returns('');
    expectError(run, 'no service name set');
  });

  it('uses default components without gcloud_component flag', async function () {
    await run();
    expect(this.stubs.installComponent.callCount).to.eq(0);
  });

  it('throws error with invalid gcloud component flag', async function () {
    this.stubs.getInput.withArgs('gcloud_component').returns('wrong_value');
    await expectError(run, 'invalid input received for gcloud_component: wrong_value');
  });

  it('installs alpha component with alpha flag', async function () {
    this.stubs.getInput.withArgs('gcloud_component').returns('alpha');
    await run();
    expect(this.stubs.installComponent.withArgs('alpha').callCount).to.eq(1);
  });

  it('installs beta component with beta flag', async function () {
    this.stubs.getInput.withArgs('gcloud_component').returns('beta');
    await run();
    expect(this.stubs.installComponent.withArgs('beta').callCount).to.eq(1);
  });

  it('updates a job if job is specified and service is not', async function () {
    this.stubs.getInput.withArgs('service').returns(undefined);
    this.stubs.getInput.withArgs('job').returns('job-name');
    await run();
    const call = this.stubs.getExecOutput.getCall(0);
    expect(call).to.be;
    const args = call.args[1];
    expect(args).to.include.members([
      'run',
      'jobs',
      'update',
      'job-name',
      '--image',
      'gcr.io/cloudrun/hello',
    ]);
  });

  it('updates a job if job is specified and service is an empty string', async function () {
    this.stubs.getInput.withArgs('service').returns('');
    this.stubs.getInput.withArgs('job').returns('job-name');
    await run();
    const call = this.stubs.getExecOutput.getCall(0);
    expect(call).to.be;
    const args = call.args[1];
    expect(args).to.include.members([
      'run',
      'jobs',
      'update',
      'job-name',
      '--image',
      'gcr.io/cloudrun/hello',
    ]);
  });

  it('ignore job if job and service are both specified', async function () {
    this.stubs.getInput.withArgs('service').returns('service-name');
    this.stubs.getInput.withArgs('job').returns('job-name');
    await run();
    const call = this.stubs.getExecOutput.getCall(0);
    expect(call).to.be;
    const args = call.args[1];
    expect(args).to.not.include.members(['jobs', 'job-name', '--platform']);
  });
});

describe('#kvToString', () => {
  const cases = [
    {
      name: `empty`,
      input: {},
      exp: ``,
    },
    {
      name: `single item`,
      input: { FOO: 'bar' },
      exp: `FOO=bar`,
    },
    {
      name: `multiple items`,
      input: { FOO: 'bar', ZIP: 'zap' },
      exp: `FOO=bar,ZIP=zap`,
    },
  ];

  cases.forEach((tc) => {
    it(tc.name, () => {
      const result = kvToString(tc.input as Record<string, string>);
      expect(result).to.eql(tc.exp);
    });
  });
});

async function expectError(fn: () => Promise<void>, want: string) {
  try {
    await fn();
    throw new Error(`expected error`);
  } catch (err) {
    const msg = errorMessage(err);
    expect(msg).to.include(want);
  }
}
