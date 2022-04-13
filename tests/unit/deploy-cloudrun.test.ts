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
import * as sinon from 'sinon';
import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as setupGcloud from '@google-github-actions/setup-cloud-sdk';
import { expect } from 'chai';
import { run, kvToString } from '../../src/deploy-cloudrun';

// These are mock data for github actions inputs, where camel case is expected.
const fakeInputs: { [key: string]: string } = {
  image: 'gcr.io/cloudrun/hello',
  service: 'test',
  metadata: '',
  credentials: '{}',
  project_id: 'my-test-project',
  env_vars: '',
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

describe('#deploy-cloudrun', function () {
  describe('#run', function () {
    beforeEach(async function () {
      this.stubs = {
        getInput: sinon.stub(core, 'getInput').callsFake(getInputMock),
        getBooleanInput: sinon.stub(core, 'getBooleanInput').returns(false),
        exportVariable: sinon.stub(core, 'exportVariable'),
        setFailed: sinon.stub(core, 'setFailed'),
        installGcloudSDK: sinon.stub(setupGcloud, 'installGcloudSDK'),
        authenticateGcloudSDK: sinon.stub(setupGcloud, 'authenticateGcloudSDK'),
        isAuthenticated: sinon.stub(setupGcloud, 'isAuthenticated').resolves(true),
        isInstalled: sinon.stub(setupGcloud, 'isInstalled').returns(false),
        parseServiceAccountKey: sinon.stub(setupGcloud, 'parseServiceAccountKey'),
        isProjectIdSet: sinon.stub(setupGcloud, 'isProjectIdSet').resolves(true),
        installComponent: sinon.stub(setupGcloud, 'installComponent'),
        getExecOutput: sinon.stub(exec, 'getExecOutput'),
      };
    });

    afterEach(function () {
      Object.keys(this.stubs).forEach((k) => this.stubs[k].restore());
    });

    it('sets the project ID if provided', async function () {
      this.stubs.getInput.withArgs('project_id').returns('my-test-project');
      await run();

      const call = this.stubs.getExecOutput.getCall(0);
      expect(call).to.be;
      const args = call.args[1];
      expect(args).to.include.members(['--project', 'my-test-project']);
    });
    it('sets the project ID if GCLOUD_PROJECT is provided', async function () {
      this.stubs.getInput.withArgs('project_id').returns('');
      this.stubs.getInput.withArgs('credentials').returns('');
      process.env.GCLOUD_PROJECT = 'my-test-project';
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
    it('authenticates if key is provided', async function () {
      this.stubs.getInput.withArgs('credentials').returns('key');
      await run();
      expect(this.stubs.authenticateGcloudSDK.withArgs('key').callCount).to.eq(1);
    });
    it('uses project id from credentials if project_id is not provided', async function () {
      this.stubs.getInput.withArgs('credentials').returns('key');
      this.stubs.getInput.withArgs('project_id').returns('');
      await run();
      expect(this.stubs.parseServiceAccountKey.withArgs('key').callCount).to.eq(1);
    });
    it('fails if credentials and project_id are not provided', async function () {
      this.stubs.getInput.withArgs('credentials').returns('');
      this.stubs.getInput.withArgs('project_id').returns('');
      process.env.GCLOUD_PROJECT = '';
      await run();
      expect(this.stubs.setFailed.callCount).to.be.at.least(1);
    });
    it('installs beta components with source', async function () {
      this.stubs.getInput.withArgs('source').returns('example-app');
      this.stubs.getInput.withArgs('image').returns('');
      await run();
      expect(this.stubs.installComponent.withArgs('beta').callCount).to.eq(1);
    });
    it('installs beta components with metadata', async function () {
      this.stubs.getInput.withArgs('metadata').returns('yaml');
      this.stubs.getInput.withArgs('image').returns('');
      this.stubs.getInput.withArgs('service').returns('');
      await run();
      expect(this.stubs.installComponent.withArgs('beta').callCount).to.eq(1);
    });
    it('sets timeout if given', async function () {
      this.stubs.getInput.withArgs('timeout').returns('55m12s');
      await run();
      const call = this.stubs.getExecOutput.getCall(0);
      expect(call).to.be;
      const args = call.args[1];
      expect(args).to.include.members(['--timeout', '55m12s']);
    });
    it('installs beta components with tag', async function () {
      this.stubs.getInput.withArgs('tag').returns('test');
      await run();
      expect(this.stubs.installComponent.withArgs('beta').callCount).to.eq(1);
    });
    it('installs beta components with tag traffic', async function () {
      this.stubs.getInput.withArgs('tag').returns('test');
      this.stubs.getInput.withArgs('name').returns('service-name');
      await run();
      expect(this.stubs.installComponent.withArgs('beta').callCount).to.eq(1);
    });
    it('fails if tag traffic and revision traffic are provided', async function () {
      this.stubs.getInput.withArgs('revision_traffic').returns('TEST=100');
      this.stubs.getInput.withArgs('tag_traffic').returns('TEST=100');
      await run();
      expect(this.stubs.setFailed.callCount).to.eq(1);
    });
    it('fails if name is not provided with tag traffic', async function () {
      this.stubs.getInput.withArgs('tag_traffic').returns('TEST=100');
      this.stubs.getInput.withArgs('name').returns('service-name');
      await run();
      expect(this.stubs.setFailed.callCount).to.eq(1);
    });
    it('fails if name is not provided with revision traffic', async function () {
      this.stubs.getInput.withArgs('revision_traffic').returns('TEST=100');
      this.stubs.getInput.withArgs('name').returns('service-name');
      await run();
      expect(this.stubs.setFailed.callCount).to.eq(1);
    });
    it('uses default components without gcloud_component flag', async function () {
      await run();
      expect(this.stubs.installComponent.callCount).to.eq(0);
    });
    it('throws error with invalid gcloud component flag', async function () {
      this.stubs.getInput.withArgs('gcloud_component').returns('wrong_value');
      await run();
      expect(
        this.stubs.setFailed.withArgs(`invalid input received for gcloud_component: wrong_value`)
          .callCount,
      ).to.be.at.least(1);
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
  });

  describe.only('#kvToString', () => {
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
});
