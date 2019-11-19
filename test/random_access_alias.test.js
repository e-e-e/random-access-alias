const randomAccessAlias = require("..");
const path = require("path");
const ram = require("random-access-memory");

function createTestResolver(resolver, timeout) {
  return name =>
    new Promise(resolve => {
      setTimeout(() => {
        resolve(resolver(name));
      }, timeout);
    });
}

const delayedTestResolver = createTestResolver(name => {
  if (name === "alias.txt") {
    return path.join(__dirname, "./data/test.txt");
  }
  return name;
}, 100);

describe("RandomAccessAlias", () => {
  it("reads from aliased file", done => {
    const raa = randomAccessAlias.create(delayedTestResolver);
    const file = raa("alias.txt");
    file.read(2, 4, (err, result) => {
      expect(err).toBe(null);
      expect(result.toString()).toBe("test");
      done();
    });
  });

  it("writes to an aliased file", done => {
    const resolver = jest.fn().mockReturnValue("all.txt");
    const raa = randomAccessAlias.create(resolver, ram);
    const file = raa("a-file");
    file.write(0, Buffer.from("Some words"), err => {
      expect(err).toBe(null);
      file.read(0, 4, (err, result) => {
        expect(err).toBe(null);
        expect(result.toString()).toBe("Some");
        expect(resolver).toBeCalledWith("a-file");
        done();
      });
    });
  });

  it("fails if resolver does not return a string", done => {
    const resolver = jest.fn().mockReturnValue(null);
    const raa = randomAccessAlias.create(resolver, ram);
    const file = raa("a-file");
    file.write(0, Buffer.from("Text"), (err, result) => {
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toEqual(
        expect.stringMatching(/Invalid filename alias\./)
      );
      done();
    });
  });

  it("throws errors if methods are used after resolver has failed", done => {
    const resolver = jest.fn().mockReturnValue(null);
    const raa = randomAccessAlias.create(resolver, ram);
    const file = raa("a-file");
    file.write(0, Buffer.from("Text"), (err, result) => {
      expect(err).toBeInstanceOf(Error);
      expect(() => file.read(0, 2, () => {})).toThrow();
      done();
    });
  });

  it("calls error callback if resolver fails", done => {
    const resolver = jest.fn().mockReturnValue(null);
    const raa = randomAccessAlias.create(resolver, ram);
    const file = raa("a-file");
    file.on("error", e => {
      expect(e).toBeInstanceOf(Error);
      done();
    });
    file.write(0, Buffer.from("Burn"), jest.fn());
  });
});
