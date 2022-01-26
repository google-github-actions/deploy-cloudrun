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
import { getExecOutput } from '@actions/exec';
import * as toolCache from '@actions/tool-cache';
import * as setupGcloud from '@google-github-actions/setup-cloud-sdk';
import path from 'path';
import { parseDeployResponse, parseUpdateTrafficResponse } from './output-parser';

export const GCLOUD_METRICS_ENV_VAR = 'CLOUDSDK_METRICS_ENVIRONMENT';
export const GCLOUD_METRICS_LABEL = 'github-actions-deploy-cloudrun';

export enum ResponseTypes {
  DEPLOY,
  UPDATE_TRAFFIC,
}

export interface DeployCloudRunInputs {
  image: string;
  name: string;
  metadata: string;
  credentials: string;
  projectId: string;
  gcloudVersion: string;
  envVars: string;
  secrets: string;
  region: string;
  source: string;
  suffix: string;
  tag: string;
  noTraffic: boolean;
  revTraffic: string;
  tagTraffic: string;
  flags: string;
}

export interface DeployCloudRunOutputs {
  url: string | null | undefined;
}

/**
 * Executes the main action. It includes the main business logic and is the
 * primary entry point. It is documented inline.
 */
export async function run(): Promise<void> {
  core.exportVariable(GCLOUD_METRICS_ENV_VAR, GCLOUD_METRICS_LABEL);
  try {
    // Get inputs
    const inputs: DeployCloudRunInputs = {
      // Core inputs
      image: core.getInput('image'), // Image ie gcr.io/...
      name: core.getInput('service'), // Service name
      metadata: core.getInput('metadata'), // YAML file
      credentials: core.getInput('credentials'), // Service account key
      projectId: core.getInput('project_id'),
      gcloudVersion: core.getInput('gcloud_version'),
      // Flags
      envVars: core.getInput('env_vars'), // String of env vars KEY=VALUE,...
      secrets: core.getInput('secrets'), // String of secrets KEY=VALUE,...
      region: core.getInput('region') || 'us-central1',
      source: core.getInput('source'), // Source directory
      suffix: core.getInput('suffix'),
      tag: core.getInput('tag'),
      noTraffic: core.getBooleanInput('no_traffic'),
      revTraffic: core.getInput('revision_traffic'),
      tagTraffic: core.getInput('tag_traffic'),
      flags: core.getInput('flags'),
    };

    // Add warning if using credentials
    if (inputs.credentials) {
      core.warning(
        '"credentials" input has been deprecated. ' +
          'Please switch to using google-github-actions/auth which supports both Workload Identity Federation and JSON Key authentication. ' +
          'For more details, see https://github.com/google-github-actions/deploy-cloudrun#credentials',
      );
    }

    let responseType = ResponseTypes.DEPLOY; // Default response type for output parsing
    let installBeta = false; // Flag for installing gcloud beta components
    let cmd;

    // Throw errors if inputs aren't valid
    if (inputs.revTraffic && inputs.tagTraffic) {
      throw new Error('Both `revision_traffic` and `tag_traffic` inputs set - Please select one.');
    }
    if ((inputs.revTraffic || inputs.tagTraffic) && !inputs.name) {
      throw new Error('No service name set.');
    }

    // Find base command
    if (inputs.revTraffic || inputs.tagTraffic) {
      // Set response type for output parsing
      responseType = ResponseTypes.UPDATE_TRAFFIC;

      // Update traffic
      cmd = [
        'run',
        'services',
        'update-traffic',
        inputs.name,
        '--platform',
        'managed',
        '--region',
        inputs.region,
      ];
      installBeta = true;
      if (inputs.revTraffic) cmd.push('--to-revisions', inputs.revTraffic);
      if (inputs.tagTraffic) cmd.push('--to-tags', inputs.tagTraffic);
    } else if (inputs.source) {
      // Deploy service from source
      cmd = [
        'run',
        'deploy',
        inputs.name,
        '--quiet',
        '--platform',
        'managed',
        '--region',
        inputs.region,
        '--source',
        inputs.source,
      ];
      installBeta = true;
    } else if (inputs.metadata) {
      // Deploy service from metadata
      if (inputs.image || inputs.name || inputs.envVars || inputs.secrets) {
        core.warning(
          'Metadata YAML provided: ignoring `image`, `service`, `env_vars` and `secrets` inputs.',
        );
      }
      cmd = [
        'run',
        'services',
        'replace',
        inputs.metadata,
        '--platform',
        'managed',
        '--region',
        inputs.region,
      ];
      installBeta = true;
    } else {
      // Deploy service with image specified
      cmd = [
        'run',
        'deploy',
        inputs.name,
        '--image',
        inputs.image,
        '--quiet',
        '--platform',
        'managed',
        '--region',
        inputs.region,
      ];
    }
    if (!inputs.metadata) {
      // Set optional flags from inputs
      if (inputs.envVars) cmd.push('--update-env-vars', inputs.envVars);
      if (inputs.secrets) {
        cmd.push('--update-secrets', inputs.secrets);
        installBeta = true;
      }
      if (inputs.tag) {
        cmd.push('--tag', inputs.tag);
        installBeta = true;
      }
      if (inputs.suffix) cmd.push('--revision-suffix', inputs.suffix);
      if (inputs.noTraffic) cmd.push('--no-traffic');
    }
    // Add optional flags
    if (inputs.flags) {
      const flagList = parseFlags(inputs.flags);
      if (flagList) cmd = cmd.concat(flagList);
    }

    // Install gcloud if not already installed.
    if (!inputs.gcloudVersion || inputs.gcloudVersion == 'latest') {
      inputs.gcloudVersion = await setupGcloud.getLatestGcloudSDKVersion();
    }
    if (!setupGcloud.isInstalled(inputs.gcloudVersion)) {
      await setupGcloud.installGcloudSDK(inputs.gcloudVersion);
    } else {
      const toolPath = toolCache.find('gcloud', inputs.gcloudVersion);
      core.addPath(path.join(toolPath, 'bin'));
    }

    // Either credentials or GOOGLE_GHA_CREDS_PATH env var required
    if (inputs.credentials || process.env.GOOGLE_GHA_CREDS_PATH) {
      await setupGcloud.authenticateGcloudSDK(inputs.credentials);
    }
    const authenticated = await setupGcloud.isAuthenticated();
    if (!authenticated) {
      throw new Error('Error authenticating the Cloud SDK.');
    }

    // set PROJECT ID
    if (inputs.projectId) {
      await setupGcloud.setProject(inputs.projectId);
    } else if (inputs.credentials) {
      inputs.projectId = await setupGcloud.setProjectWithKey(inputs.credentials);
    } else if (process.env.GCLOUD_PROJECT) {
      await setupGcloud.setProject(process.env.GCLOUD_PROJECT);
    }
    // Fail if no Project Id is provided if not already set.
    const projectIdSet = await setupGcloud.isProjectIdSet();
    if (!projectIdSet)
      throw new Error(
        'No project Id provided. Ensure you have set either the project_id or credentials fields.',
      );

    // Install beta components if needed and prepend the beta command
    if (installBeta) {
      await setupGcloud.installComponent('beta');
      cmd.unshift('beta');
    }

    // Set output format to json
    cmd.push('--format', 'json');

    const toolCommand = setupGcloud.getToolCommand();
    const options = { silent: true };
    const commandString = `${toolCommand} ${cmd.join(' ')}`;
    core.info(`Running: ${commandString}`);

    // Run gcloud cmd.
    const output = await getExecOutput(toolCommand, cmd, options);
    if (output.exitCode !== 0) {
      const errMsg = output.stderr || `command exited ${output.exitCode}, but stderr had no output`;
      throw new Error(`failed to execute gcloud command \`${commandString}\`: ${errMsg}`);
    }

    // Map outputs by response type
    let outputs;
    try {
      switch (responseType) {
        case ResponseTypes.UPDATE_TRAFFIC:
          outputs = parseUpdateTrafficResponse(inputs, output.stdout);
          break;
        default:
          outputs = parseDeployResponse(inputs, output.stdout);
          break;
      }
    } catch (e) {
      throw new Error(`failed to parse gcloud command output: ${e}`);
    }

    // Map outputs to GitHub actions output
    setActionOutputs(outputs);
  } catch (error) {
    core.setFailed(convertUnknown(error));
  }
}

// Map output response to GitHub Action outputs
export function setActionOutputs(outputs: DeployCloudRunOutputs): void {
  Object.keys(outputs).forEach((key: string) => {
    core.setOutput(key, outputs[key as keyof DeployCloudRunOutputs]);
  });
}

export function parseFlags(flags: string): RegExpMatchArray {
  return flags.match(/(".*?"|[^"\s=]+)+(?=\s*|\s*$)/g)!; // Split on space or "=" if not in quotes
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function convertUnknown(unknown: any): string {
  if (unknown instanceof Error) {
    return unknown.message;
  }
  return unknown as string;
}
