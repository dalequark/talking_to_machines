// Copyright 2020 Google LLC

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at

//     https://www.apache.org/licenses/LICENSE-2.0

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
}

function getAdditionQuestion(min, max) {
    const [a, b] = [randomInt(min, max), randomInt(min, max)];
    return {
        "question" : `What is ${a} plus ${b}?`,
        "answer" : a + b
    }
}

function getSubtractionQuestion(min, max) {
    const a = randomInt(min, max);
    const b = randomInt(min, a);
    return {
        "question" : `What is ${a} minus ${b}?`,
        "answer" : a - b
    }
}

function getMultiplicationQuestion(min, max) {
    const a = randomInt(min, max);
    const b = randomInt(min, max);
    return {
        "question" : `What is ${a} times ${b}?`,
        "answer" : a * b
    }
}

module.exports.getEasyQuestion = () => {
    const [min, max] = [0, 30];
    return (Math.random() < 0.5) ? 
        getAdditionQuestion(min, max) : getSubtractionQuestion(min, max);
};

module.exports.getMediumQuestion = () => {
    // Give a multiplication, addition, or subtraction question
    if (Math.random() <= 1/3) {
        return getMultiplicationQuestion(5, 15);
    }
    else if (Math.random() <= 2/3) {
        return getSubtractionQuestion(30, 100);
    }

    return getAdditionQuestion(30, 100);

};

module.exports.getHardQuestion = () => {
    return getMultiplicationQuestion(1000, 5000);
};