// Copyright 2020 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

const assert = require("chai").assert;
require("chai").should();
const admin = require("firebase-admin");

const myFunctions = require("../analyze.js"); // relative path to functions code

describe("#analyzeText", async () => {
  let response;
  before(async () => {
    response = await myFunctions.analyzeText(
      "I hate country music and I love C++ and feel neutral about cats"
    );
  });
  it("returns a nonempty array", () => {
    response.should.be.an("array").that.is.not.empty;
  });
  it("contains three entities", () => {
    response.should.have.lengthOf(3);
  });

  context("negative entity", () => {
    let entity;
    before(() => {
      entity = response[0];
    });
    it("should have name, sentiment, and magnitude key", () => {
      entity.should.include.keys("name", "sentiment", "magnitude");
    });
    it("should have an entity name `country music`", () => {
      entity["name"].should.equal("country music");
    });
    it("should have a sentiment score < 0", () => {
      entity["sentiment"].should.be.below(0);
    });
    it("should have a magnitude above 0.5", () => {
      entity["magnitude"].should.be.above(0.5);
    });
  });

  context("positive entity", () => {
    let entity;
    before(() => {
      entity = response[1];
    });
    it("should have name, sentiment, and magnitude key", () => {
      entity.should.include.keys("name", "sentiment", "magnitude");
    });
    it("should have an entity name `C++`", () => {
      entity["name"].should.equal("C++");
    });
    it("should have a sentiment score > 0", () => {
      entity["sentiment"].should.be.above(0);
    });
    it("should have a magnitude above 0.5", () => {
      entity["magnitude"].should.be.above(0.5);
    });
  });

  context("neutral entity", () => {
    let entity;
    before(() => {
      entity = response[2];
    });
    it("should have name, sentiment, and magnitude key", () => {
      entity.should.include.keys("name", "sentiment", "magnitude");
    });
    it("should have an entity name `C++`", () => {
      entity["name"].should.equal("cats");
    });
    it("should have a magnitude below 0.5", () => {
      entity["magnitude"].should.be.below(0.5);
    });
  });
});
