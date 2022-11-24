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

import _ from 'lodash';
import { getExecOutput } from '@actions/exec';
import { run_v1 } from 'googleapis';
import yaml from 'js-yaml';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms, []));
}

/* eslint-disable @typescript-eslint/no-non-null-assertion */
describe('E2E tests', function () {
  const {
    PROJECT_ID,
    PARAMS,
    ANNOTATIONS,
    LABELS,
    ENV,
    SECRET_ENV,
    SECRET_VOLUMES,
    SERVICE,
    REVISION_COUNT,
    REVISION,
    TAG,
    TRAFFIC,
  } = process.env;

  let service: run_v1.Schema$Service;
  let toolCommand: string;
  before(async function () {
    toolCommand = 'gcloud';
    if (SERVICE && PROJECT_ID) {
      // get Service yaml
      const cmd = [
        'run',
        'services',
        'describe',
        SERVICE,
        '--project',
        PROJECT_ID,
        '--format',
        'yaml',
        '--platform',
        'managed',
        '--region',
        'us-central1',
      ];

      const options = { silent: true };
      const commandString = `${toolCommand} ${cmd.join(' ')}`;
      const output = await getExecOutput(toolCommand, cmd, options);
      if (output.exitCode !== 0) {
        const errMsg =
          output.stderr || `command exited ${output.exitCode}, but stderr had no output`;
        throw new Error(`failed to execute gcloud command \`${commandString}\`: ${errMsg}`);
      }

      service = yaml.load(output.stdout) as run_v1.Schema$Service;
      if (!service) console.error('no service found');
    }
  });

  it('has the correct env vars', function () {
    if (ENV && service) {
      const expected = parseEnvVars(ENV);
      const env = _.get(service, 'spec.template.spec.containers[0].env')!.filter(
        (entry) => entry && entry.value,
      );
      expect(env).to.deep.eq(expected);
    }
  });

  it('has the correct secret vars', function () {
    if (SECRET_ENV && service) {
      const expected = parseEnvVars(SECRET_ENV);
      const env = _.get(service, 'spec.template.spec.containers[0].env')!
        .filter((entry) => entry && entry.valueFrom)
        .map((entry) => {
          const ref = entry.valueFrom!.secretKeyRef!;
          return { name: entry.name, value: `${ref.name}:${ref.key}` };
        });
      expect(env).to.deep.eq(expected);
    }
  });

  it('has the correct secret volumes', function () {
    if (SECRET_VOLUMES && service) {
      const expected = parseEnvVars(SECRET_VOLUMES);
      const spec: run_v1.Schema$RevisionSpec = _.get(service, 'spec.template.spec')!;
      const volumes = spec.volumes;
      const volumeMounts = spec.containers![0]?.volumeMounts;
      expect(volumes).to.have.lengthOf(expected.length);
      volumeMounts?.forEach((volumeMount: run_v1.Schema$VolumeMount) => {
        const secretVolume = volumes?.find((volume: run_v1.Schema$Volume) =>
          _.isEqual(volumeMount.name, volume.name),
        );
        const actualSecretPath = volumeMount.mountPath?.concat(
          '/',
          secretVolume?.secret?.items![0].path ?? '',
        );
        const found = expected.find((expectedSecretPath) =>
          _.isEqual(expectedSecretPath.name, actualSecretPath),
        );
        expect(found).to.not.equal(undefined);
      });
    }
  });

  it('has the correct params', function () {
    if (PARAMS && service) {
      const expected = JSON.parse(PARAMS);
      const actual = _.get(service, 'spec.template.spec')!;

      if (expected.containerConncurrency) {
        expect(actual.containerConcurrency).to.equal(expected.containerConncurrency);
      }
      if (expected.timeoutSeconds) {
        expect(actual.timeoutSeconds).to.equal(expected.timeoutSeconds);
      }

      const actualResources = actual.containers![0]?.resources;
      if (expected.cpu) {
        expect(actualResources!.limits!.cpu).to.equal(expected.cpu.toString());
      }
      if (expected.memory) {
        expect(actualResources!.limits!.memory).to.equal(expected.memory);
      }
    }
  });

  it('has the correct annotations', function () {
    if (ANNOTATIONS && service) {
      const expected = JSON.parse(ANNOTATIONS);
      const actual = _.get(service, 'spec.template.metadata.annotations')!;
      expect(actual).to.deep.include(expected);
    }
  });

  it('has the correct labels', function () {
    if (LABELS && service) {
      const expected = JSON.parse(LABELS);
      const actual = _.get(service, 'spec.template.metadata.labels')!;
      expect(actual).to.deep.eq(expected);
    }
  });

  it('has the correct revision count', async function () {
    if (REVISION_COUNT && SERVICE && PROJECT_ID) {
      const max = 3;
      const attempt = 0;
      let revisions = [];
      while (attempt < max && revisions.length < parseInt(REVISION_COUNT)) {
        await sleep(1000 * attempt);
        const cmd = [
          'run',
          'revisions',
          'list',
          '--project',
          PROJECT_ID,
          '--service',
          SERVICE,
          '--format',
          'json',
          '--platform',
          'managed',
          '--region',
          'us-central1',
        ];

        const options = { silent: true };
        const commandString = `${toolCommand} ${cmd.join(' ')}`;

        const output = await getExecOutput(toolCommand, cmd, options);
        if (output.exitCode !== 0) {
          const errMsg =
            output.stderr || `command exited ${output.exitCode}, but stderr had no output`;
          throw new Error(`failed to execute gcloud command \`${commandString}\`: ${errMsg}`);
        }
        revisions = JSON.parse(output.stdout);
      }

      expect(revisions.length).to.equal(parseInt(REVISION_COUNT));
    }
  });

  it('has the correct revision name', function () {
    if (REVISION && service) {
      const actual = _.get(service, 'spec.template.metadata.name');
      expect(REVISION).to.eq(actual);
    }
  });

  it('has the correct tag', function () {
    if (TAG && service) {
      const traffic = _.get(service, 'spec.traffic')!;
      const actual = traffic.find((rev: run_v1.Schema$TrafficTarget) => {
        return rev['tag'] == TAG;
      })!;
      expect(TAG).to.eq(actual['tag']);
    }
  });

  it('has the correct traffic', function () {
    if (TAG && TRAFFIC && service) {
      const traffic = _.get(service, 'spec.traffic')!;
      const tagged = traffic.find((rev: run_v1.Schema$TrafficTarget) => {
        return rev['tag'] == TAG;
      })!;
      const actual = traffic.find((rev: run_v1.Schema$TrafficTarget) => {
        return rev['revisionName'] == tagged['revisionName'];
      })!;
      const percent = actual['percent']!;
      expect(parseInt(TRAFFIC)).to.equal(percent);
    }
  });

  function parseEnvVars(envVarInput: string): run_v1.Schema$EnvVar[] {
    const envVarList = envVarInput.split(',');
    const envVars = envVarList.map((envVar) => {
      if (!envVar.includes('=')) {
        throw new TypeError(
          `Env Vars must be in "KEY1=VALUE1,KEY2=VALUE2" format, received ${envVar}`,
        );
      }
      const keyValue = envVar.split('=');
      return { name: keyValue[0], value: keyValue[1] };
    });
    return envVars;
  }
});
