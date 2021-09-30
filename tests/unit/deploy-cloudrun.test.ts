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
import * as setupGcloud from '@google-github-actions/setup-cloud-sdk';
import { expect } from 'chai';
import { run, setUrlOutput, parseFlags } from '../../src/deploy-cloudrun';

/* eslint-disable @typescript-eslint/camelcase */
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
  no_traffic: '',
  revision_traffic: '',
  tag_traffic: ''
};
/* eslint-enable @typescript-eslint/camelcase */

function getInputMock(name: string): string {
  return fakeInputs[name];
}

describe('#run', function() {
  beforeEach(async function() {
    this.stubs = {
      getInput: sinon.stub(core, 'getInput').callsFake(getInputMock),
      exportVariable: sinon.stub(core, 'exportVariable'),
      setFailed: sinon.stub(core, 'setFailed'),
      installGcloudSDK: sinon.stub(setupGcloud, 'installGcloudSDK'),
      authenticateGcloudSDK: sinon.stub(setupGcloud, 'authenticateGcloudSDK'),
      isAuthenticated: sinon.stub(setupGcloud, 'isAuthenticated').resolves(true),
      isInstalled: sinon.stub(setupGcloud, 'isInstalled').returns(false),
      setProject: sinon.stub(setupGcloud, 'setProject'),
      setProjectWithKey: sinon.stub(setupGcloud, 'setProjectWithKey'),
      isProjectIdSet: sinon.stub(setupGcloud, 'isProjectIdSet').resolves(true),
      installComponent: sinon.stub(setupGcloud, 'installComponent'),
    };
  });

  afterEach(function() {
    Object.keys(this.stubs).forEach((k) => this.stubs[k].restore());
  });

  it('sets the project ID if provided', async function() {
    this.stubs.getInput.withArgs('project_id').returns('my-test-project');
    await run();
    expect(this.stubs.setProject.withArgs('my-test-project').callCount).to.eq(1);
  });
  it('sets the project ID if GCLOUD_PROJECT is provided', async function() {
    this.stubs.getInput.withArgs('project_id').returns('');
    this.stubs.getInput.withArgs('credentials').returns('');
    process.env.GCLOUD_PROJECT = 'my-test-project';
    await run();
    expect(this.stubs.setProject.withArgs('my-test-project').callCount).to.eq(1);
  });
  it('does not set the project ID if not provided', async function() {
    this.stubs.getInput.withArgs('project_id').returns('');
    this.stubs.getInput.withArgs('credentials').returns('');
    process.env.GCLOUD_PROJECT = '';
    await run();
    expect(this.stubs.setProject.callCount).to.eq(0);
  });
  it('installs the gcloud SDK if it is not already installed', async function() {
    this.stubs.isInstalled.returns(false);
    await run();
    expect(this.stubs.installGcloudSDK.callCount).to.eq(1);
  });
  it('uses the cached gcloud SDK if it was already installed', async function() {
    this.stubs.isInstalled.returns(true);
    await run();
    expect(this.stubs.installGcloudSDK.callCount).to.eq(0);
  });
  it('authenticates if key is provided', async function() {
    this.stubs.getInput.withArgs('credentials').returns('key');
    await run();
    expect(this.stubs.authenticateGcloudSDK.withArgs('key').callCount).to.eq(1);
  });
  it('uses project id from credentials if project_id is not provided', async function() {
    this.stubs.getInput.withArgs('credentials').returns('key');
    this.stubs.getInput.withArgs('project_id').returns('');
    await run();
    expect(this.stubs.setProjectWithKey.withArgs('key').callCount).to.eq(1);
  });
  it('fails if credentials and project_id are not provided', async function() {
    this.stubs.getInput.withArgs('credentials').returns('');
    this.stubs.getInput.withArgs('project_id').returns('');
    process.env.GCLOUD_PROJECT = '';
    await run();
    expect(this.stubs.setFailed.callCount).to.be.at.least(1);
  });
  it('installs beta components with source', async function() {
    this.stubs.getInput.withArgs('source').returns('example-app');
    this.stubs.getInput.withArgs('image').returns('');
    await run();
    expect(this.stubs.installComponent.withArgs('beta').callCount).to.eq(1);
  });
  it('installs beta components with metadata', async function() {
    this.stubs.getInput.withArgs('metadata').returns('yaml');
    this.stubs.getInput.withArgs('image').returns('');
    this.stubs.getInput.withArgs('service').returns('');
    await run();
    expect(this.stubs.installComponent.withArgs('beta').callCount).to.eq(1);
  });
  it('installs beta components with tag', async function() {
    this.stubs.getInput.withArgs('tag').returns('test');
    await run();
    expect(this.stubs.installComponent.withArgs('beta').callCount).to.eq(1);
  });
  it('installs beta components with tag traffic', async function() {
    this.stubs.getInput.withArgs('tag').returns('test');
    this.stubs.getInput.withArgs('name').returns('service-name');
    await run();
    expect(this.stubs.installComponent.withArgs('beta').callCount).to.eq(1);
  });
  it('fails if tag traffic and revision traffic are provided', async function() {
    this.stubs.getInput.withArgs('revision_traffic').returns('TEST=100');
    this.stubs.getInput.withArgs('tag_traffic').returns('TEST=100');
    await run();
    expect(this.stubs.setFailed.callCount).to.eq(1);
  });
  it('fails if name is not provided with tag traffic', async function() {
    this.stubs.getInput.withArgs('tag_traffic').returns('TEST=100');
    this.stubs.getInput.withArgs('name').returns('service-name');
    await run();
    expect(this.stubs.setFailed.callCount).to.eq(1);
  });
  it('fails if name is not provided with revision traffic', async function() {
    this.stubs.getInput.withArgs('revision_traffic').returns('TEST=100');
    this.stubs.getInput.withArgs('name').returns('service-name');
    await run();
    expect(this.stubs.setFailed.callCount).to.eq(1);
  });
});

describe('#parseFlags', function() {
  it('parses flags using equals', async function() {
    const input = '--concurrency=2 --memory=2Gi';
    const results = parseFlags(input);
    expect(results).to.eql(["--concurrency", "2", "--memory", "2Gi"])
  })
  it('parses flags using spaces', async function() {
    const input = '--concurrency 2 --memory 2Gi';
    const results = parseFlags(input);
    expect(results).to.eql(["--concurrency", "2", "--memory", "2Gi"])
  })
  it('parses flags using combo', async function() {
    const input = '--concurrency 2 --memory=2Gi';
    const results = parseFlags(input);
    expect(results).to.eql(["--concurrency", "2", "--memory", "2Gi"])
  })
  it('parses flags using space and quotes combo', async function() {
    const input = '--concurrency 2 --memory="2 Gi"';
    const results = parseFlags(input);
    expect(results).to.eql(["--concurrency", "2", "--memory", "\"2 Gi\""])
  })
  it('parses flags using space and quotes', async function() {
    const input = '--entry-point "node index.js"';
    const results = parseFlags(input);
    expect(results).to.eql(["--entry-point", "\"node index.js\""])
  })
  it('parses flags using equals and quotes', async function() {
    const input = '--entry-point="node index.js"';
    const results = parseFlags(input);
    expect(results).to.eql(["--entry-point", "\"node index.js\""])
  })
})

describe('#setUrlOutput', function() {
  it('correctly parses the URL', function() {
    const output = `
    Allow unauthenticated invocations to [action-test] (y/N)?  
    Deploying container to Cloud Run service [action-test] in project [PROJECT] region [us-central1]
    ✓ Deploying new service... Done.                                                                                                      
    ✓ Creating Revision...                                                                                                              
    ✓ Routing traffic...                                                                                                                
    Done.                                                                                                                                 
    Service [action-test] revision [action-test-00001-guw] has been deployed and is serving 100 percent of traffic.
    Service URL: https://action-test-cy7cdwrvha-uc.a.run.app
    `;
    const url = setUrlOutput(output);
    expect(url).to.eq('https://action-test-cy7cdwrvha-uc.a.run.app');
  });

  it('correctly parses 2 URLs', function() {
    const output = `
    Deploying container to Cloud Run service [action-test] in project [PROJECT] region [us-central1]
    ✓ Deploying... Done.                                                                                                                                                                                                                                                           
    ✓ Creating Revision...                                                                                                                                                                                                                                                       
    ✓ Routing traffic...                                                                                                                                                                                                                                                         
    Done.                                                                                                                                                                                                                                                                          
    Service [action-test] revision [action-test-00002-gaw] has been deployed and is serving 100 percent of traffic.
    Service URL: https://action-test-cy7cdwrvha-uc.a.run.app
    The revision can be reached directly at https://actions-tag---action-test-cy7cdwrvha-uc.a.run.app
    `;
    const url = setUrlOutput(output);
    expect(url).to.eq(
      'https://actions-tag---action-test-cy7cdwrvha-uc.a.run.app',
    );
  });

  it('returns undefined', function() {
    const output = `
    Deploying container to Cloud Run service [action-test] in project [PROJECT] region [us-central1]
    ⠹ Deploying... Invalid ENTRYPOINT.
    `;
    const url = setUrlOutput(output);
    expect(url).to.eq(undefined);
  });

  it('correctly parses updated traffic', function() {
    const output = `
    ✓ Updating traffic... Done.                                                                                                                                                                                                                                                    
    ✓ Routing traffic...                                                                                                                                                                                                                                                         
    Done.                                                                                                                                                                                                                                                                          
    URL: https://action-test-cy7cdwrvha-uc.a.run.app
    Traffic:
      100% action-test-00002-gaw
            actions-tag: https://actions-tag---action-test-cy7cdwrvha-uc.a.run.app
    `;
    const url = setUrlOutput(output);
    expect(url).to.eq(
      'https://actions-tag---action-test-cy7cdwrvha-uc.a.run.app',
    );
  });

  it('correctly parses metadata updates', function() {
    const output = `
    Applying new configuration to Cloud Run service [run-full-yaml] in project [PROJECT] region [us-central1]
    ✓ Deploying new service... Done.                                                                                                                                                                                                                                               
    ✓ Creating Revision...                                                                                                                                                                                                                                                       
    ✓ Routing traffic...                                                                                                                                                                                                                                                         
    Done.                                                                                                                                                                                                                                                                          
    New configuration has been applied to service [run-full-yaml].
    URL: https://run-full-yaml-cy7cdwrvha-uc.a.run.app
    `;
    const url = setUrlOutput(output);
    expect(url).to.eq('https://run-full-yaml-cy7cdwrvha-uc.a.run.app');
  });
});
