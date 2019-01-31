<main>

# MetaES

## About MetaES as a metacircular interpreter

[MetaES](http://metaes.org/) is a building block for other libraries and tools. It was created to speed up applications development. 

Try it out at the [playground](http://metaes.org/playground.html).

## Installing

For the latest stable version:

```bash
npm install metaes
```

For dev builds:

```bash
npm install metaes@dev
```

## Using MetaES

It's highly recommended to read [docs](http://metaes.org/docs-metaes.html) first. You can skip it if you just want to use MetaES in a most basic way.

### node.js example

```javascript
const { metaesEval } = require("metaes");
metaesEval(`2+a`, console.log, console.error, { a: 2 });
```

For browser usage you have to create build yourself using tools like Webpack, Parcel or others.

will print out `4`.

## Documentation

Available at [docs](http://metaes.org/docs-metaes.html) page.

## Development

For development repository installation use following:

```bash
git clone git@github.com:metaes/metaes.git
cd metaes
npm install
```

## Testing

```bash
npm test
```

## Contribution 

Use GitHub [issues](http://github.com/metaes/metaes/issues) or [pull requests](https://github.com/metaes/metaes/pulls).

## License

MIT.