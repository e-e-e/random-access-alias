# Random Access Alias

[![Build Status](https://travis-ci.org/e-e-e/random-access-alias.svg?branch=master)](https://travis-ci.org/e-e-e/random-access-alias)

A proxy wrapper for any [random-access-storage](https://github.com/random-access-storage/random-access-storage) compatible store which allows aliased mapping of filenames.

This is useful for creating virtual file structures without having to change any directory structures on disk, or duplicate shared files.

## Installation

```bash
npm install --save random-access-alias
```

## Usage

```js
const randomAccessAlias = require("random-access-alias");
const ram = require("random-access-memory");
// A simple resolver - this could also query a database or parse and transform the name.
// Resolvers can be async functions.
const resolver = name => {
  switch (name) {
    case "marx/capital/some.pdf":
      return "data/files/marx_capital_v1.pdf";
    case "marx/capital/metadata.opf":
      return "data/files/marx_capital_v1.opf";
    default:
      return name;
  }
};

// Pass the resolver and RAS implementation to create an aliased version.
const raa = randomAccessAlias.create(resolver, ram);
const options = {
  // ... options to be provided to the RAS implementation used.
};
// Create store which may be used the same as any other Random Access Storage.
const store = raa("marx/capital/some.pdf", options);
```
