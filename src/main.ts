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
import {
  errorMessage,
  parseKVString,
  parseFlags,
  presence,
} from '@google-github-actions/actions-utils';
import * as setupGcloud from '@google-github-actions/setup-cloud-sdk';
import path from 'path';
import { parseDeployResponse, parseUpdateTrafficResponse } from './output-parser';

export const GCLOUD_METRICS_ENV_VAR = 'CLOUDSDK_METRICS_ENVIRONMENT';
export const GCLOUD_METRICS_LABEL = 'github-actions-deploy-cloudrun';

/**
 * DeployCloudRunOutputs are the common GitHub action outputs created by this action
 */
export interface DeployCloudRunOutputs {
  url?: string | null | undefined; // Type required to match run_v1.Schema$Service.status.url
}

/**
 * ResponseTypes are the gcloud command response formats
 */
enum ResponseTypes {
  DEPLOY,
  UPDATE_TRAFFIC,
}

/**
 * Executes the main action. It includes the main business logic and is the
 * primary entry point. It is documented inline.
 */
export async function run(): Promise<void> {
  core.exportVariable(GCLOUD_METRICS_ENV_VAR, GCLOUD_METRICS_LABEL);
  try {
    // Get inputs
    // Core inputs
    const image = core.getInput('image'); // Image ie gcr.io/...
    const name = core.getInput('service'); // Service name
    const metadata = core.getInput('metadata'); // YAML file
    const credentials = core.getInput('credentials'); // Service account key
    let projectId = core.getInput('project_id');
    let gcloudVersion = core.getInput('gcloud_version');
    const gcloudComponent = presence(core.getInput('gcloud_component')); // Cloud SDK component version
    // Flags
    const envVars = parseKVString(core.getInput('env_vars')); // String of env vars KEY=VALUE,...
    const secrets = parseKVString(core.getInput('secrets')); // String of secrets KEY=VALUE,...
    const region = core.getInput('region') || 'us-central1';
    const source = core.getInput('source'); // Source directory
    const suffix = core.getInput('suffix');
    const tag = core.getInput('tag');
    const timeout = core.getInput('timeout');
    const noTraffic = core.getBooleanInput('no_traffic');
    const revTraffic = core.getInput('revision_traffic');
    const tagTraffic = core.getInput('tag_traffic');
    const labels = parseKVString(core.getInput('labels'));
    const flags = core.getInput('flags');

    // Add warning if using credentials
    if (credentials) {
      core.warning(
        '"credentials" input has been deprecated. ' +
          'Please switch to using google-github-actions/auth which supports both Workload Identity Federation and JSON Key authentication. ' +
          'For more details, see https://github.com/google-github-actions/deploy-cloudrun#credentials',
      );
    }

    let responseType = ResponseTypes.DEPLOY; // Default response type for output parsing
    let cmd;

    // Throw errors if inputs aren't valid
    if (revTraffic && tagTraffic) {
      throw new Error('Both `revision_traffic` and `tag_traffic` inputs set - Please select one.');
    }
    if ((revTraffic || tagTraffic) && !name) {
      throw new Error('No service name set.');
    }

    // Validate gcloud component input
    if (gcloudComponent && gcloudComponent !== 'alpha' && gcloudComponent !== 'beta') {
      throw new Error(`invalid input received for gcloud_component: ${gcloudComponent}`);
    }

    // Find base command
    if (revTraffic || tagTraffic) {
      // Set response type for output parsing
      responseType = ResponseTypes.UPDATE_TRAFFIC;

      // Update traffic
      cmd = [
        'run',
        'services',
        'update-traffic',
        name,
        '--platform',
        'managed',
        '--region',
        region,
      ];
      if (revTraffic) cmd.push('--to-revisions', revTraffic);
      if (tagTraffic) cmd.push('--to-tags', tagTraffic);
    } else if (source) {
      // Deploy service from source
      cmd = [
        'run',
        'deploy',
        name,
        '--quiet',
        '--platform',
        'managed',
        '--region',
        region,
        '--source',
        source,
      ];
      if (timeout) cmd.push('--timeout', timeout);
    } else if (metadata) {
      // Deploy service from metadata
      if (image || name || envVars || secrets || timeout || labels) {
        core.warning(
          `Metadata YAML provided, ignoring: "image", "service", "env_vars", "secrets", "labels", and "timeout" inputs.`,
        );
      }
      cmd = ['run', 'services', 'replace', metadata, '--platform', 'managed', '--region', region];
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
      if (envVars && Object.keys(envVars).length > 0) {
        cmd.push('--update-env-vars', kvToString(envVars));
      }
      if (secrets && Object.keys(secrets).length > 0) {
        cmd.push('--update-secrets', kvToString(secrets));
      }
      if (tag) {
        cmd.push('--tag', tag);
      }
      if (suffix) cmd.push('--revision-suffix', suffix);
      if (noTraffic) cmd.push('--no-traffic');
      if (labels && Object.keys(labels).length > 0) {
        cmd.push('--update-labels', kvToString(labels));
      }
    }
    if (timeout) cmd.push('--timeout', timeout);
    // Add optional flags
    if (flags) {
      const flagList = parseFlags(flags);
      if (flagList) cmd = cmd.concat(flagList);
    }

    // Install gcloud if not already installed.
    if (!gcloudVersion || gcloudVersion == 'latest') {
      gcloudVersion = await setupGcloud.getLatestGcloudSDKVersion();
    }
    if (!setupGcloud.isInstalled(gcloudVersion)) {
      await setupGcloud.installGcloudSDK(gcloudVersion);
    } else {
      const toolPath = toolCache.find('gcloud', gcloudVersion);
      core.addPath(path.join(toolPath, 'bin'));
    }

    // Either credentials or GOOGLE_GHA_CREDS_PATH env var required
    if (credentials || process.env.GOOGLE_GHA_CREDS_PATH) {
      await setupGcloud.authenticateGcloudSDK(credentials);
    }
    const authenticated = await setupGcloud.isAuthenticated();
    if (!authenticated) {
      throw new Error('Error authenticating the Cloud SDK.');
    }

    // set PROJECT ID
    if (!projectId) {
      if (credentials) {
        const key = setupGcloud.parseServiceAccountKey(credentials);
        projectId = key.project_id;
      } else if (process.env.GCLOUD_PROJECT) {
        projectId = process.env.GCLOUD_PROJECT;
      }
    }
    if (projectId) cmd.push('--project', projectId);

    // Install gcloud component if needed and prepend the command
    if (gcloudComponent) {
      await setupGcloud.installComponent(gcloudComponent);
      cmd.unshift(gcloudComponent);
    }

    // Set output format to json
    cmd.push('--format', 'json');

    const toolCommand = setupGcloud.getToolCommand();
    const options = { silent: true, ignoreReturnCode: true };
    const commandString = `${toolCommand} ${cmd.join(' ')}`;
    core.info(`Running: ${commandString}`);

    // Run gcloud cmd.
    const output = await getExecOutput(toolCommand, cmd, options);
    if (output.exitCode !== 0) {
      const errMsg = output.stderr || `command exited ${output.exitCode}, but stderr had no output`;
      throw new Error(`failed to execute gcloud command \`${commandString}\`: ${errMsg}`);
    }

    // Map outputs by response type
    const outputs: DeployCloudRunOutputs =
      responseType === ResponseTypes.UPDATE_TRAFFIC
        ? parseUpdateTrafficResponse(output.stdout)
        : parseDeployResponse(output.stdout, { tag: tag });

    // Map outputs to GitHub actions output
    setActionOutputs(outputs);
  } catch (err) {
    const msg = errorMessage(err);
    core.setFailed(`google-github-actions/deploy-cloudrun failed with: ${msg}`);
  }
}

/**
 * kvToString takes the given string=string records into a single string that
 * the gcloud CLI expects.
 */
export function kvToString(kv: Record<string, string>, separator = ','): string {
  return Object.entries(kv)
    .map(([k, v]) => {
      return `${k}=${v}`;
    })
    .join(separator);
}

// Map output response to GitHub Action outputs
export function setActionOutputs(outputs: DeployCloudRunOutputs): void {
  Object.keys(outputs).forEach((key: string) => {
    core.setOutput(key, outputs[key as keyof DeployCloudRunOutputs]);
  });
}

if (require.main === module) {
  run();
}
