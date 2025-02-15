// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import assert from "assert";
import * as utils from "../lib/util/utils";

describe("Utility functions", () => {
  describe("Get Provider", () => {
    it("should throw on empty", () => {
      assert.throws(() => {
        utils.getProvider("");
      });
    });
    it("should throw null", () => {
      assert.throws(() => {
        utils.getProvider(null);
      });
    });
    it("should throw undefined", () => {
      assert.throws(() => {
        utils.getProvider();
      });
    });
    it("should return Microsoft.Resources", () => {
      const path =
        "/subscriptions/{subscriptionId}/resourcegroups/{resourceGroupName}/providers/" +
        "Microsoft.Resources/{parentResourcePath}/{resourceType}/{resourceName}";
      const provider = utils.getProvider(path);
      assert.strictEqual(provider, "Microsoft.Resources");
    });
    it("should return undefined", () => {
      const path = "/subscriptions/{subscriptionId}/resourcegroups/{resourceGroupName}/providers/";
      const provider = utils.getProvider(path);
      assert.strictEqual(provider, undefined);
    });
    it("should return Microsoft.Authorization", () => {
      const path =
        "/subscriptions/{subscriptionId}/resourcegroups/{resourceGroupName}/providers/" +
        "Microsoft.Resources/{parentResourcePath}/{resourceType}/{resourceName}/providers/" +
        "Microsoft.Authorization/roleAssignments";
      const provider = utils.getProvider(path);
      assert.strictEqual(provider, "Microsoft.Authorization");
    });
  });

  describe("Get value by json pointer", () => {
    const resp = {
      body: {
        sku: {
          sku: "standard",
        },
        properties: {
          value: "kkk",
          arrayValue: ["abc", "def"],
        },
      },
    };
    it("should return expected value", () => {
      const jsonPointer = "/body/properties/value";
      const res = utils.getValueByJsonPointer(resp, jsonPointer);
      expect(res).toBe("kkk");

      const secondArrayItemJsonPointer = "/body/properties/arrayValue/1";
      const arrayItem = utils.getValueByJsonPointer(resp, secondArrayItemJsonPointer);
      expect(arrayItem).toBe("def");
    });

    it("should throw error when the jsonPointer is invalid", () => {
      const t = () => {
        const jsonPointer = "/body/unknown";
        utils.getValueByJsonPointer(resp, jsonPointer);
      };
      expect(t).toThrow("Invalid reference token: unknown");
    });
  });
});
