// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import * as util from "util";
import { keys, mapEntries } from "@azure-tools/openapi-tools-common";
import * as Sway from "yasway";
import * as C from "../util/constants";

import { CommonError } from "../util/commonError";
import { log } from "../util/logging";
import { processErrors } from "../util/processErrors";
import { validateResponse } from "../util/validationResponse";
import { TitleObject } from "./specTransformer";
import { CommonValidationResult, SpecValidator } from "./specValidator";
import { existSuppression } from "./suppressions";

export interface Result {
  isValid?: unknown;
  error?: CommonError;
  warning?: unknown;
  result?: unknown;
  errors?: unknown;
  warnings?: unknown;
}

export interface SemanticValidationResult extends CommonValidationResult {
  validateSpec?: Result;
  initialize?: unknown;
}

export class SemanticValidatorDeprecated extends SpecValidator<SemanticValidationResult> {
  // eslint-disable-next-line @typescript-eslint/require-await
  public async validateSpec(): Promise<Sway.ValidationResults> {
    this.specValidationResult.validateSpec = {
      isValid: true,
      errors: [],
      warnings: [],
    };
    if (!this.swaggerApi) {
      const msg =
        `Please call "specValidator.initialize()" before calling this method, ` +
        `so that swaggerApi is populated.`;
      const e = this.constructErrorObject({
        code: C.ErrorCodes.InitializationError,
        message: msg,
      });
      this.specValidationResult.initialize = e;
      this.specValidationResult.validateSpec.isValid = false;
      log.error(`${C.ErrorCodes.InitializationError.name}: ${msg}`);
      throw e;
    }
    try {
      const validationResult = this.swaggerApi.validate();
      if (validationResult) {
        if (
          (this.suppression &&
            this.specPath &&
            !existSuppression(
              this.specPath,
              this.suppression,
              C.ErrorCodes.DiscriminatorNotRequired.id
            )) ||
          this.suppression === undefined ||
          this.specPath === undefined
        ) {
          const discriminatorValidationResult = this.validateDiscriminator();
          if (discriminatorValidationResult) {
            validationResult.errors = validationResult.errors.concat(discriminatorValidationResult);
          }
        }

        if (validationResult.errors && validationResult.errors.length) {
          this.specValidationResult.validateSpec.isValid = false;
          processErrors(validationResult.errors);
          const e = this.constructErrorObject({
            code: C.ErrorCodes.SemanticValidationError,
            message: `The spec ${this.specPath} has semantic validation errors.`,
            innerErrors: validationResult.errors,
          });
          this.specValidationResult.validateSpec.errors = validateResponse.constructErrors(
            e,
            this.specPath,
            this.getProviderNamespace()
          );
          log.error(C.Errors);
          log.error("------");
          this.updateValidityStatus();
          log.error(e as any);
        } else {
          this.specValidationResult.validateSpec.result = `The spec ${this.specPath} is semantically valid.`;
        }
        if (validationResult.warnings && validationResult.warnings.length > 0) {
          processErrors(validationResult.warnings);
          validationResult.warnings = validateResponse.sanitizeWarnings(validationResult.warnings);
          if (validationResult.warnings && validationResult.warnings.length > 0) {
            this.specValidationResult.validateSpec.warnings = validationResult.warnings;
            log.debug(C.Warnings);
            log.debug("--------");
            log.debug(util.inspect(validationResult.warnings));
          }
        }
      }
      return validationResult;
    } catch (err) {
      const msg = `An Internal Error occurred in validating the spec "${this.specPath}". \t${err.message}.`;
      err.code = C.ErrorCodes.InternalError.name;
      err.id = C.ErrorCodes.InternalError.id;
      err.message = msg;
      this.specValidationResult.validateSpec.isValid = false;
      this.specValidationResult.validateSpec.error = err;
      log.error(err);
      this.updateValidityStatus();
      throw err;
    }
  }

  private getProviderNamespace(): string | null {
    const re = /^(.*)\/providers\/(\w+\.\w+)\/(.*)$/gi;
    if (this.specInJson) {
      if (this.specInJson.paths) {
        for (const pathStr of keys(this.specInJson.paths)) {
          const res = re.exec(pathStr);
          if (res && res[2]) {
            return res[2];
          }
        }
      }
    }
    return null;
  }

  /**
   * Validate discriminator must be a required property
   */
  private validateDiscriminator(): Sway.ValidationEntry[] {
    const spec = this.specInJson;
    const definitions = spec.definitions as Sway.DefinitionsObject;
    const validationEntries: Sway.ValidationEntry[] = [];
    for (const modelEntry of mapEntries(definitions)) {
      const model = modelEntry[1];
      const discriminator = model.discriminator;
      if (discriminator) {
        if (!model.required || !model.required.includes(discriminator)) {
          let path = modelEntry[0];
          if (model.title) {
            const title: TitleObject = JSON.parse(model.title);
            if (title.path) {
              path = title.path.join();
            }
          }
          const validateEntry: Sway.ValidationEntry = {
            code: C.ErrorCodes.DiscriminatorNotRequired.id,
            error: C.ErrorCodes.DiscriminatorNotRequired.name,
            name: "discriminator",
            params: [discriminator],
            message: "discriminator must be a required property.",
            path: [path],
          } as any;
          validationEntries.push(validateEntry);
        }
      }
    }
    return validationEntries;
  }
}
