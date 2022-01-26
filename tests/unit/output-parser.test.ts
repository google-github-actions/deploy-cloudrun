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

import 'mocha';
import { expect } from 'chai';
import {
  parseUpdateTrafficResponse,
  parseDeployResponse,
  ParseInputs,
} from '../../src/output-parser';

describe('#output-parser', function () {
  describe('#parseUpdateTrafficResponse', function () {
    const cases: {
      name: string;
      input: { stdout: string };
      error?: boolean;
      expected: string;
    }[] = [
      {
        name: 'parses update traffic outputs',
        input: {
          stdout: `
            [
              {
                "displayPercent": "100%",
                "displayRevisionId": "LATEST (currently test-basic-yaml-00007-leg)",
                "displayTags": "",
                "key": "LATEST",
                "latestRevision": true,
                "revisionName": "test-basic-yaml-00007-leg",
                "serviceUrl": "https://test-basic-yaml-4goqgbaxqq-uc.a.run.app",
                "specPercent": "100",
                "specTags": "-",
                "statusPercent": "100",
                "statusTags": "-",
                "tags": [],
                "urls": []
              }
            ]
          `,
        },
        expected: 'https://test-basic-yaml-4goqgbaxqq-uc.a.run.app',
      },
      {
        name: 'parses update traffic with single tag',
        input: {
          stdout: `
            [
              {
                "displayPercent": "0%",
                "displayRevisionId": "test-basic-yaml-00005-yus",
                "displayTags": "my-tag-1",
                "key": "test-basic-yaml-00005-yus",
                "latestRevision": false,
                "revisionName": "test-basic-yaml-00005-yus",
                "serviceUrl": "https://test-basic-yaml-4goqgbaxqq-uc.a.run.app",
                "specPercent": "0",
                "specTags": "my-tag-1",
                "statusPercent": "0",
                "statusTags": "my-tag-1",
                "tags": [
                  {
                    "inSpec": true,
                    "inStatus": true,
                    "tag": "my-tag-1",
                    "url": "https://my-tag-1---test-basic-yaml-4goqgbaxqq-uc.a.run.app"
                  }
                ],
                "urls": [
                  "https://my-tag-1---test-basic-yaml-4goqgbaxqq-uc.a.run.app"
                ]
              },
              {
                "displayPercent": "100%",
                "displayRevisionId": "LATEST (currently test-basic-yaml-00007-leg)",
                "displayTags": "",
                "key": "LATEST",
                "latestRevision": true,
                "revisionName": "test-basic-yaml-00007-leg",
                "serviceUrl": "https://test-basic-yaml-4goqgbaxqq-uc.a.run.app",
                "specPercent": "100",
                "specTags": "-",
                "statusPercent": "100",
                "statusTags": "-",
                "tags": [],
                "urls": []
              }
            ]
          `,
        },
        expected: 'https://my-tag-1---test-basic-yaml-4goqgbaxqq-uc.a.run.app',
      },
      {
        name: 'parses update traffic with multiple tags',
        input: {
          stdout: `
          [
            {
              "displayPercent": "20%",
              "displayRevisionId": "test-basic-yaml-00005-yus",
              "displayTags": "my-tag-1, my-tag-2",
              "key": "test-basic-yaml-00005-yus",
              "latestRevision": false,
              "revisionName": "test-basic-yaml-00005-yus",
              "serviceUrl": "https://test-basic-yaml-4goqgbaxqq-uc.a.run.app",
              "specPercent": "20",
              "specTags": "my-tag-1, my-tag-2",
              "statusPercent": "20",
              "statusTags": "my-tag-1, my-tag-2",
              "tags": [
                {
                  "inSpec": true,
                  "inStatus": true,
                  "tag": "my-tag-1",
                  "url": "https://my-tag-1---test-basic-yaml-4goqgbaxqq-uc.a.run.app"
                },
                {
                  "inSpec": true,
                  "inStatus": true,
                  "tag": "my-tag-2",
                  "url": "https://my-tag-2---test-basic-yaml-4goqgbaxqq-uc.a.run.app"
                }
              ],
              "urls": [
                "https://my-tag-1---test-basic-yaml-4goqgbaxqq-uc.a.run.app",
                "https://my-tag-2---test-basic-yaml-4goqgbaxqq-uc.a.run.app"
              ]
            },
            {
              "displayPercent": "40%",
              "displayRevisionId": "test-basic-yaml-00006-juz",
              "displayTags": "another-2, test-2",
              "key": "test-basic-yaml-00006-juz",
              "latestRevision": false,
              "revisionName": "test-basic-yaml-00006-juz",
              "serviceUrl": "https://test-basic-yaml-4goqgbaxqq-uc.a.run.app",
              "specPercent": "40",
              "specTags": "another-2, test-2",
              "statusPercent": "40",
              "statusTags": "another-2, test-2",
              "tags": [
                {
                  "inSpec": true,
                  "inStatus": true,
                  "tag": "another-2",
                  "url": "https://another-2---test-basic-yaml-4goqgbaxqq-uc.a.run.app"
                },
                {
                  "inSpec": true,
                  "inStatus": true,
                  "tag": "test-2",
                  "url": "https://test-2---test-basic-yaml-4goqgbaxqq-uc.a.run.app"
                }
              ],
              "urls": [
                "https://another-2---test-basic-yaml-4goqgbaxqq-uc.a.run.app",
                "https://test-2---test-basic-yaml-4goqgbaxqq-uc.a.run.app"
              ]
            },
            {
              "displayPercent": "40%",
              "displayRevisionId": "test-basic-yaml-00007-leg",
              "displayTags": "another-1, test-1",
              "key": "test-basic-yaml-00007-leg",
              "latestRevision": false,
              "revisionName": "test-basic-yaml-00007-leg",
              "serviceUrl": "https://test-basic-yaml-4goqgbaxqq-uc.a.run.app",
              "specPercent": "40",
              "specTags": "another-1, test-1",
              "statusPercent": "40",
              "statusTags": "another-1, test-1",
              "tags": [
                {
                  "inSpec": true,
                  "inStatus": true,
                  "tag": "another-1",
                  "url": "https://another-1---test-basic-yaml-4goqgbaxqq-uc.a.run.app"
                },
                {
                  "inSpec": true,
                  "inStatus": true,
                  "tag": "test-1",
                  "url": "https://test-1---test-basic-yaml-4goqgbaxqq-uc.a.run.app"
                }
              ],
              "urls": [
                "https://another-1---test-basic-yaml-4goqgbaxqq-uc.a.run.app",
                "https://test-1---test-basic-yaml-4goqgbaxqq-uc.a.run.app"
              ]
            }
          ]
        `,
        },
        expected: 'https://my-tag-1---test-basic-yaml-4goqgbaxqq-uc.a.run.app',
      },
      {
        name: 'handles empty stdout',
        error: true,
        input: {
          stdout: '[]',
        },
        expected: 'gcloud response is empty: []',
      },
    ];

    cases.forEach((tc) => {
      it(tc.name, function () {
        if (tc?.error) {
          expect(() => {
            parseUpdateTrafficResponse(tc.input.stdout);
          }).to.throw(tc.expected);
        } else {
          const { url } = parseUpdateTrafficResponse(tc.input.stdout);
          expect(url).to.eq(tc.expected);
        }
      });
    });
  });

  describe('#parseDeployResponse', function () {
    const cases: {
      name: string;
      input: { inputs?: ParseInputs; stdout: string };
      error?: boolean;
      expected: string;
    }[] = [
      {
        name: 'parses deploy outputs',
        input: {
          stdout: `
            {
              "apiVersion": "serving.knative.dev/v1",
              "kind": "Service",
              "metadata": {
                "annotations": {
                  "client.knative.dev/user-image": "image-name:1.0.0",
                  "run.googleapis.com/client-name": "gcloud",
                  "run.googleapis.com/client-version": "368.0.0",
                  "run.googleapis.com/ingress": "internal",
                  "run.googleapis.com/ingress-status": "internal",
                  "serving.knative.dev/creator": "creator@domain.com",
                  "serving.knative.dev/lastModifier": "creator@domain.com"
                },
                "creationTimestamp": "2022-01-25T21:10:53.714758Z",
                "generation": 2,
                "labels": {
                  "cloud.googleapis.com/location": "us-central1"
                },
                "name": "hello",
                "namespace": "392520182231",
                "resourceVersion": "AAXWbpADof4",
                "selfLink": "/apis/serving.knative.dev/v1/namespaces/392520182231/services/hello",
                "uid": "a79b8fc9-f05b-468c-809a-7bb28988fb00"
              },
              "spec": {
                "template": {
                  "metadata": {
                    "annotations": {
                      "autoscaling.knative.dev/maxScale": "2",
                      "client.knative.dev/user-image": "image-name:1.0.0",
                      "run.googleapis.com/client-name": "gcloud",
                      "run.googleapis.com/client-version": "368.0.0"
                    },
                    "name": "hello-00002-hex"
                  },
                  "spec": {
                    "containerConcurrency": 80,
                    "containers": [
                      {
                        "image": "image-name:1.0.0",
                        "ports": [
                          {
                            "containerPort": 8080,
                            "name": "http1"
                          }
                        ],
                        "resources": {
                          "limits": {
                            "cpu": "1000m",
                            "memory": "512Mi"
                          }
                        }
                      }
                    ],
                    "serviceAccountName": "000000000-compute@developer.gserviceaccount.com",
                    "timeoutSeconds": 300
                  }
                },
                "traffic": [
                  {
                    "latestRevision": true,
                    "percent": 100
                  }
                ]
              },
              "status": {
                "address": {
                  "url": "https://action-test-cy7cdwrvha-uc.a.run.app"
                },
                "conditions": [
                  {
                    "lastTransitionTime": "2022-01-25T21:13:54.457086Z",
                    "status": "True",
                    "type": "Ready"
                  },
                  {
                    "lastTransitionTime": "2022-01-25T21:13:48.190586Z",
                    "status": "True",
                    "type": "ConfigurationsReady"
                  },
                  {
                    "lastTransitionTime": "2022-01-25T21:13:54.457086Z",
                    "status": "True",
                    "type": "RoutesReady"
                  }
                ],
                "latestCreatedRevisionName": "hello-00002-hex",
                "latestReadyRevisionName": "hello-00002-hex",
                "observedGeneration": 2,
                "traffic": [
                  {
                    "latestRevision": true,
                    "percent": 100,
                    "revisionName": "hello-00002-hex"
                  }
                ],
                "url": "https://action-test-cy7cdwrvha-uc.a.run.app"
              }
            }
          `,
        },
        expected: 'https://action-test-cy7cdwrvha-uc.a.run.app',
      },
      {
        name: 'parses deploy outputs with tag',
        input: {
          inputs: { tag: 'test' },
          stdout: `
            {
              "apiVersion": "serving.knative.dev/v1",
              "kind": "Service",
              "metadata": {
                "annotations": {
                  "client.knative.dev/user-image": "us-docker.pkg.dev/cloudrun/container/hello@sha256:1595248959b1eaac7f793dfcab2adaecf9c14fdf1cc2b60d20539c6b22fd8e4a",
                  "run.googleapis.com/client-name": "gcloud",
                  "run.googleapis.com/client-version": "368.0.0",
                  "run.googleapis.com/ingress": "internal",
                  "run.googleapis.com/ingress-status": "internal",
                  "serving.knative.dev/creator": "verbanicm@google.com",
                  "serving.knative.dev/lastModifier": "verbanicm@google.com"
                },
                "creationTimestamp": "2022-01-25T21:10:53.714758Z",
                "generation": 9,
                "labels": {
                  "cloud.googleapis.com/location": "us-central1"
                },
                "name": "hello",
                "namespace": "392520182231",
                "resourceVersion": "AAXWb88QKzQ",
                "selfLink": "/apis/serving.knative.dev/v1/namespaces/392520182231/services/hello",
                "uid": "a79b8fc9-f05b-468c-809a-7bb28988fb00"
              },
              "spec": {
                "template": {
                  "metadata": {
                    "annotations": {
                      "autoscaling.knative.dev/maxScale": "2",
                      "client.knative.dev/user-image": "us-docker.pkg.dev/cloudrun/container/hello@sha256:1595248959b1eaac7f793dfcab2adaecf9c14fdf1cc2b60d20539c6b22fd8e4a",
                      "run.googleapis.com/client-name": "gcloud",
                      "run.googleapis.com/client-version": "368.0.0"
                    },
                    "name": "hello-suffix"
                  },
                  "spec": {
                    "containerConcurrency": 80,
                    "containers": [
                      {
                        "image": "us-docker.pkg.dev/cloudrun/container/hello@sha256:1595248959b1eaac7f793dfcab2adaecf9c14fdf1cc2b60d20539c6b22fd8e4a",
                        "ports": [
                          {
                            "containerPort": 8080,
                            "name": "http1"
                          }
                        ],
                        "resources": {
                          "limits": {
                            "cpu": "1000m",
                            "memory": "512Mi"
                          }
                        }
                      }
                    ],
                    "serviceAccountName": "392520182231-compute@developer.gserviceaccount.com",
                    "timeoutSeconds": 300
                  }
                },
                "traffic": [
                  {
                    "percent": 100,
                    "revisionName": "hello-00007-jec"
                  },
                  {
                    "revisionName": "hello-00005-zay",
                    "tag": "test"
                  },
                  {
                    "revisionName": "hello-00007-jec",
                    "tag": "another"
                  }
                ]
              },
              "status": {
                "address": {
                  "url": "https://hello-4goqgbaxqq-uc.a.run.app"
                },
                "conditions": [
                  {
                    "lastTransitionTime": "2022-01-25T22:43:07.210548Z",
                    "status": "True",
                    "type": "Ready"
                  },
                  {
                    "lastTransitionTime": "2022-01-25T22:43:07.210548Z",
                    "status": "True",
                    "type": "ConfigurationsReady"
                  },
                  {
                    "lastTransitionTime": "2022-01-25T22:41:16.384919Z",
                    "status": "True",
                    "type": "RoutesReady"
                  }
                ],
                "latestCreatedRevisionName": "hello-suffix",
                "latestReadyRevisionName": "hello-suffix",
                "observedGeneration": 9,
                "traffic": [
                  {
                    "percent": 100,
                    "revisionName": "hello-00007-jec"
                  },
                  {
                    "revisionName": "hello-00005-zay",
                    "tag": "test",
                    "url": "https://test---hello-4goqgbaxqq-uc.a.run.app"
                  },
                  {
                    "revisionName": "hello-00007-jec",
                    "tag": "another",
                    "url": "https://another---hello-4goqgbaxqq-uc.a.run.app"
                  }
                ],
                "url": "https://hello-4goqgbaxqq-uc.a.run.app"
              }
            }
          `,
        },
        expected: 'https://test---hello-4goqgbaxqq-uc.a.run.app',
      },
      {
        name: 'handles invalid stdout',
        error: true,
        input: {
          stdout: `{}`,
        },
        expected: 'gcloud response is missing url: {}',
      },
    ];

    cases.forEach((tc: any) => {
      it(tc.name, function () {
        if (tc?.error) {
          expect(() => {
            parseDeployResponse(tc.input.stdout, tc.input.inputs);
          }).to.throw(tc.expected);
        } else {
          const { url } = parseDeployResponse(tc.input.stdout, tc.input.inputs);
          expect(url).to.eq(tc.expected);
        }
      });
    });
  });
});
