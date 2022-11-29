/*
 * Copyright 2022 Google LLC
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

import { DeployCloudRunOutputs } from './main';
import { run_v1 } from 'googleapis';
import { errorMessage, presence } from '@google-github-actions/actions-utils';

/**
 * ParseInputs are the input values from GitHub actions used for parsing logic
 */
export interface ParseInputs {
  [key: string]: string | boolean;
}

/**
 * UpdateTrafficItem is the response type for the gcloud run services update-traffic command
 */
interface UpdateTrafficItem {
  displayPercent: string;
  displayRevisionId: string;
  displayTags: string;
  key: string;
  latestRevision: boolean;
  revisionName: string;
  serviceUrl: string;
  specPercent: string;
  specTags: string;
  statusPercent: string;
  statusTags: string;
  tags: string[];
  urls: string[];
}

/**
 * parseUpdateTrafficResponse parses the gcloud command response for update-traffic
 * into a common DeployCloudRunOutputs object
 *
 * @param stdout
 * @returns DeployCloudRunOutputs
 */
export function parseUpdateTrafficResponse(stdout: string | undefined): DeployCloudRunOutputs {
  try {
    stdout = presence(stdout);
    if (!stdout || stdout === '{}' || stdout === '[]') {
      return {};
    }

    const outputJSON: UpdateTrafficItem[] = JSON.parse(stdout);

    // Default to service url
    const responseItem = outputJSON[0];
    let url = responseItem?.serviceUrl;

    // Maintain current logic to use first tag URL if present
    for (const item of outputJSON) {
      if (item?.urls?.length) {
        url = item.urls[0];
        break;
      }
    }

    const outputs: DeployCloudRunOutputs = { url: url };

    return outputs;
  } catch (err) {
    const msg = errorMessage(err);
    throw new Error(`failed to parse update traffic response: ${msg}, stdout: ${stdout}`);
  }
}

/**
 * parseDeployResponse parses the gcloud command response for gcloud run deploy/replace
 * into a common DeployCloudRunOutputs object
 *
 * @param stdout Standard output from gcloud command
 * @param inputs Action inputs used in parsing logic
 * @returns DeployCloudRunOutputs
 */
export function parseDeployResponse(
  stdout: string | undefined,
  inputs: ParseInputs | undefined,
): DeployCloudRunOutputs {
  try {
    stdout = presence(stdout);
    if (!stdout || stdout === '{}' || stdout === '[]') {
      return {};
    }

    const outputJSON: run_v1.Schema$Service = JSON.parse(stdout);

    // Set outputs
    const outputs: DeployCloudRunOutputs = {
      url: outputJSON?.status?.url,
    };

    // Maintain current logic to use tag url if provided
    if (inputs?.tag) {
      const tagInfo = outputJSON?.status?.traffic?.find((t) => t.tag === inputs.tag);
      if (tagInfo) {
        outputs.url = tagInfo.url;
      }
    }

    return outputs;
  } catch (err) {
    const msg = errorMessage(err);
    throw new Error(
      `failed to parse deploy response: ${msg}, stdout: ${stdout}, inputs: ${JSON.stringify(
        inputs,
      )}`,
    );
  }
}
