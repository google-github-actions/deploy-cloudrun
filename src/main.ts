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

import path from 'path';

import {
  addPath,
  getInput,
  info as logInfo,
  setFailed,
  setOutput,
  warning as logWarning,
} from '@actions/core';
import { getExecOutput } from '@actions/exec';
import * as toolCache from '@actions/tool-cache';
import {
  errorMessage,
  isPinnedToHead,
  KVPair,
  parseBoolean,
  parseFlags,
  parseKVString,
  parseKVStringAndFile,
  pinnedToHeadWarning,
  presence,
  stubEnv,
} from '@google-github-actions/actions-utils';
import {
  authenticateGcloudSDK,
  getLatestGcloudSDKVersion,
  getToolCommand,
  installComponent as installGcloudComponent,
  installGcloudSDK,
  isInstalled as isGcloudInstalled,
} from '@google-github-actions/setup-cloud-sdk';

import { parseDeployResponse, parseUpdateTrafficResponse } from './output-parser';

// Do not listen to the linter - this can NOT be rewritten as an ES6 import
// statement.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { version: appVersion } = require('../package.json');

// isDebug returns true if runner debugging or step debugging is enabled.
const isDebug =
  parseBoolean(process.env.ACTIONS_RUNNER_DEBUG) || parseBoolean(process.env.ACTIONS_STEP_DEBUG);

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
  // Register metrics
  const restoreEnv = stubEnv({
    CLOUDSDK_METRICS_ENVIRONMENT: 'github-actions-deploy-cloudrun',
    CLOUDSDK_METRICS_ENVIRONMENT_VERSION: appVersion,
  });

  // Warn if pinned to HEAD
  if (isPinnedToHead()) {
    logWarning(pinnedToHeadWarning('v1'));
  }

  try {
    // Get action inputs
    const image = getInput('image'); // Image ie gcr.io/...
    const service = getInput('service'); // Service name
    const metadata = getInput('metadata'); // YAML file
    const projectId = getInput('project_id');
    const gcloudVersion = await computeGcloudVersion(getInput('gcloud_version'));
    const gcloudComponent = presence(getInput('gcloud_component')); // Cloud SDK component version
    const envVars = getInput('env_vars'); // String of env vars KEY=VALUE,...
    const envVarsFile = getInput('env_vars_file'); // File that is a string of env vars KEY=VALUE,...
    const secrets = parseKVString(getInput('secrets')); // String of secrets KEY=VALUE,...
    const region = getInput('region') || 'us-central1';
    const source = getInput('source'); // Source directory
    const suffix = getInput('suffix');
    const tag = getInput('tag');
    const timeout = getInput('timeout');
    const noTraffic = (getInput('no_traffic') || '').toLowerCase() === 'true';
    const revTraffic = getInput('revision_traffic');
    const tagTraffic = getInput('tag_traffic');
    const labels = parseKVString(getInput('labels'));
    const skipDefaultLabels = parseBoolean(getInput('skip_default_labels'));
    const flags = getInput('flags');

    let responseType = ResponseTypes.DEPLOY; // Default response type for output parsing
    let cmd;

    // Throw errors if inputs aren't valid
    if (revTraffic && tagTraffic) {
      throw new Error('Only one of `revision_traffic` or `tag_traffic` inputs can be set.');
    }
    if ((revTraffic || tagTraffic) && !service) {
      throw new Error('No service name set.');
    }
    if (source && image) {
      throw new Error('Only one of `source` or `image` inputs can be set.');
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
      cmd = ['run', 'services', 'update-traffic', service];
      if (revTraffic) cmd.push('--to-revisions', revTraffic);
      if (tagTraffic) cmd.push('--to-tags', tagTraffic);

      const providedButIgnored: Record<string, boolean> = {
        image: image !== '',
        metadata: metadata !== '',
        source: source !== '',
        env_vars: envVars !== '',
        no_traffic: noTraffic,
        secrets: Object.keys(secrets).length > 0,
        suffix: suffix !== '',
        tag: tag !== '',
        labels: Object.keys(labels).length > 0,
        timeout: timeout !== '',
      };
      for (const key in providedButIgnored) {
        if (providedButIgnored[key]) {
          logWarning(`Updating traffic, ignoring "${key}" input`);
        }
      }
    } else if (metadata) {
      cmd = ['run', 'services', 'replace', metadata];

      const providedButIgnored: Record<string, boolean> = {
        image: image !== '',
        service: service !== '',
        source: source !== '',
        env_vars: envVars !== '',
        no_traffic: noTraffic,
        secrets: Object.keys(secrets).length > 0,
        suffix: suffix !== '',
        tag: tag !== '',
        revision_traffic: revTraffic !== '',
        tag_traffic: revTraffic !== '',
        labels: Object.keys(labels).length > 0,
        timeout: timeout !== '',
      };
      for (const key in providedButIgnored) {
        if (providedButIgnored[key]) {
          logWarning(`Using metadata YAML, ignoring "${key}" input`);
        }
      }
    } else {
      cmd = ['run', 'deploy', service, '--quiet'];

      if (image) {
        // Deploy service with image specified
        cmd.push('--image', image);
      } else if (source) {
        // Deploy service from source
        cmd.push('--source', source);
      }

      // Set optional flags from inputs
      const compiledEnvVars = parseKVStringAndFile(envVars, envVarsFile);
      if (compiledEnvVars && Object.keys(compiledEnvVars).length > 0) {
        cmd.push('--update-env-vars', kvToString(compiledEnvVars));
      }
      if (secrets && Object.keys(secrets).length > 0) {
        cmd.push('--update-secrets', kvToString(secrets));
      }
      if (tag) {
        cmd.push('--tag', tag);
      }
      if (suffix) cmd.push('--revision-suffix', suffix);
      if (noTraffic) cmd.push('--no-traffic');
      if (timeout) cmd.push('--timeout', timeout);

      // Compile the labels
      const defLabels = skipDefaultLabels ? {} : defaultLabels();
      const compiledLabels = Object.assign({}, defLabels, labels);
      if (compiledLabels && Object.keys(compiledLabels).length > 0) {
        cmd.push('--update-labels', kvToString(compiledLabels));
      }
    }

    // Push common flags
    cmd.push('--platform', 'managed');
    cmd.push('--format', 'json');
    if (region) cmd.push('--region', region);
    if (projectId) cmd.push('--project', projectId);

    // Add optional flags
    if (flags) {
      const flagList = parseFlags(flags);
      if (flagList) cmd = cmd.concat(flagList);
    }

    // Install gcloud if not already installed.
    if (!isGcloudInstalled(gcloudVersion)) {
      await installGcloudSDK(gcloudVersion);
    } else {
      const toolPath = toolCache.find('gcloud', gcloudVersion);
      addPath(path.join(toolPath, 'bin'));
    }

    // Install gcloud component if needed and prepend the command
    if (gcloudComponent) {
      await installGcloudComponent(gcloudComponent);
      cmd.unshift(gcloudComponent);
    }

    // Authenticate - this comes from google-github-actions/auth.
    const credFile = process.env.GOOGLE_GHA_CREDS_PATH;
    if (credFile) {
      await authenticateGcloudSDK(credFile);
      logInfo('Successfully authenticated');
    } else {
      logWarning('No authentication found, authenticate with `google-github-actions/auth`.');
    }

    const toolCommand = getToolCommand();
    const options = { silent: !isDebug, ignoreReturnCode: true };
    const commandString = `${toolCommand} ${cmd.join(' ')}`;
    logInfo(`Running: ${commandString}`);

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
    setFailed(`google-github-actions/deploy-cloudrun failed with: ${msg}`);
  } finally {
    restoreEnv();
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
    setOutput(key, outputs[key as keyof DeployCloudRunOutputs]);
  });
}

/**
 * defaultLabels returns the default labels to apply to the Cloud Run service.
 *
 * @return KVPair
 */
function defaultLabels(): KVPair {
  const rawValues: Record<string, string | undefined> = {
    'managed-by': 'github-actions',
    'commit-sha': process.env.GITHUB_SHA,
  };

  const labels: KVPair = {};
  for (const key in rawValues) {
    const value = rawValues[key];
    if (value) {
      // Labels can only be lowercase
      labels[key] = value.toLowerCase();
    }
  }

  return labels;
}

/**
 * computeGcloudVersion computes the appropriate gcloud version for the given
 * string.
 */
async function computeGcloudVersion(str: string): Promise<string> {
  str = (str || '').trim();
  if (str === '' || str === 'latest') {
    return await getLatestGcloudSDKVersion();
  }
  return str;
}

/**
 * execute the main function when this module is required directly.
 */
if (require.main === module) {
  run();
}
