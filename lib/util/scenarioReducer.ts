// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import { empty, mapEntries } from "@azure-tools/openapi-tools-common";

import { CommonError } from "./commonError";
import { ModelValidationError } from "./modelValidationError";
import { MultipleScenarios, responseReducer, Scenario } from "./responseReducer";
import { toModelErrors } from "./toModelErrors";
import { processValidationResult, ValidationResult } from "./validationError";
import { ValidationResultSource } from "./validationResultSource";

export interface Result {
  isValid?: unknown;
  error?: CommonError;
  warning?: unknown;
  result?: unknown;
  errors?: unknown;
  warnings?: unknown;
}

export type OperationExampleResult = MultipleScenarios;

export type OperationResultType = "x-ms-examples" | "example-in-spec";

export interface OperationResult {
  "x-ms-examples"?: MultipleScenarios;
  "example-in-spec"?: Scenario;
}

export function scenarioReducer(
  scenarioName: string,
  scenario: Scenario,
  operationId: string
): Iterable<ModelValidationError> {
  const request = scenario.request;
  if (request === undefined) {
    throw new Error("request is undefined");
  }
  const rawValidationResult: ValidationResult<ModelValidationError> = {
    requestValidationResult: {
      errors: request.error ? request.error.innerErrors : [],
    },
    responseValidationResult: {
      errors: [],
    },
  };
  // process request separately since its unique
  const processedErrors = processValidationResult(rawValidationResult);

  if (processedErrors.requestValidationResult.errors === undefined) {
    throw new Error("ICE: processedErrors.requestValidationResult.errors === undefined");
  }
  const modelErrors = !request.isValid
    ? toModelErrors(
        processedErrors.requestValidationResult.errors,
        operationId,
        scenarioName,
        ValidationResultSource.REQUEST,
        "ALL"
      )
    : empty<ModelValidationError>();

  // process responses
  rawValidationResult.requestValidationResult.errors = [];

  const entries = mapEntries(scenario.responses);
  const invalidResponses = entries.filter((entry) => {
    const [, response] = entry;
    return !response.isValid;
  });
  const result = invalidResponses.flatMap((response) => {
    const [responseCode] = response;
    return responseReducer(responseCode, scenario, rawValidationResult, operationId, scenarioName);
  });
  return modelErrors.concat(result);
}
