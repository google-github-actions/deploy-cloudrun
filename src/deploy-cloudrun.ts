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

import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as setupGcloud from '../setup-google-cloud-sdk/src/';

/**
 * Executes the main action. It includes the main business logic and is the
 * primary entry point. It is documented inline.
 */
export async function run(): Promise<void> {
  try {
    // Get inputs
    // Core inputs
    const image = core.getInput('image'); // Image ie gcr.io/...
    const name = core.getInput('service'); // Service name
    const metadata = core.getInput('metadata'); // YAML file
    const credentials = core.getInput('credentials'); // Service account key
    let projectId = core.getInput('project_id');
    // Flags
    const envVars = core.getInput('env_vars'); // String of env vars KEY=VALUE,...
    const region = core.getInput('region') || 'us-central1';

    let installBeta = false; // Flag for installing gcloud beta components
    let cmd;

    // Find base command
    if (metadata) {
      // Deploy service from metadata
      if (image || name || envVars) {
        core.warning(
          'Metadata YAML provided: ignoring `image`, `service`, and `env_vars` inputs.',
        );
      }
      cmd = [
        'beta',
        'run',
        'services',
        'replace',
        metadata,
        '--platform',
        'managed',
        '--region',
        region,
      ];
      installBeta = true;
    } else {
      // Deploy service with image specified
      cmd = [
        'run',
        'deploy',
        name,
        '--image',
        image,
        '--quiet',
        '--platform',
        'managed',
        '--region',
        region,
      ];
    }
    if (!metadata) {
      // Set optional flags from inputs
      if (envVars) cmd.push('--update-env-vars', envVars);
    }

    // Install gcloud if not already installed.
    if (!setupGcloud.isInstalled()) {
      const gcloudVersion = await setupGcloud.getLatestGcloudSDKVersion();
      await setupGcloud.installGcloudSDK(gcloudVersion);
    }

    // Authenticate gcloud SDK.
    if (credentials) await setupGcloud.authenticateGcloudSDK(credentials);
    const authenticated = await setupGcloud.isAuthenticated();
    if (!authenticated) {
      core.setFailed('Error authenticating the Cloud SDK.');
    }

    // set PROJECT ID
    if (projectId) {
      await setupGcloud.setProject(projectId);
    } else if (credentials) {
      projectId = await setupGcloud.setProjectWithKey(credentials);
    }
    // Fail if no Project Id is provided if not already set.
    const projectIdSet = await setupGcloud.isProjectIdSet();
    if (!projectIdSet) core.setFailed('No project Id provided.');

    // Install beta components if needed
    if (installBeta) await setupGcloud.installComponent('beta');

    const toolCommand = setupGcloud.getToolCommand();

    // Get output of gcloud cmd.
    let output = '';
    const stdout = (data: Buffer): void => {
      output += data.toString();
    };
    let errOutput = '';
    const stderr = (data: Buffer): void => {
      errOutput += data.toString();
    };

    const options = {
      listeners: {
        stderr,
        stdout,
      },
      silent: true,
    };

    // Run gcloud cmd.
    try {
      await exec.exec(toolCommand, cmd, options);
      // Set url as output.
      setUrlOutput(errOutput);
    } catch (error) {
      if (errOutput) {
        throw new Error(errOutput);
      } else {
        throw new Error(error);
      }
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

function setUrlOutput(output: string): void {
  const urlMatch = output.match(
    /https:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.app/g,
  );
  if (!urlMatch) {
    core.warning('Can not find URL.');
    return;
  }
  const url = urlMatch!.length > 1 ? urlMatch![1] : urlMatch![0];
  core.setOutput('url', url);
}
