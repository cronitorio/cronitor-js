# Cronitor Caller

## Installation

`npm install cronitor-caller`

## Usage

```javascript
// If you're using an auth key for your api calls:
var cronitor = require('cronitor-caller')(authKey)

// if you're NOT using an auth key for your api calls:
var cronitor = require('cronitor-caller')()

// api matches cronitor's
cronitor.run('d3x0c1')
cronitor.complete('d3x0c1')
cronitor.fail('d3x0c1', 'not enough foo')
```

## Contributing

Contributions are welcome
