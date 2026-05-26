const { expect } = require("chai");

function expectBn(actual, expected) {
    const expectedStr =
        expected && expected._isBigNumber ? expected.toString() : String(expected);
    expect(actual.toString()).to.equal(expectedStr);
}

module.exports = { expectBn };
