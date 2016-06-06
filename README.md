# Cronitor Caller
[![Travis Build](https://img.shields.io/travis/bigethan/cronitor-caller/master.svg)](https://travis-ci.org/bigethan/cronitor-caller)
[![Coveralls](https://img.shields.io/coveralls/bigethan/cronitor-caller/master.svg)](https://coveralls.io/github/bigethan/cronitor-caller?branch=master)
![dependencies](https://img.shields.io/badge/dependencies-NONE!-brightgreen.svg)


A dependency free module for triggering cronitor ping urls. If you want to
create/view/modify your cronitors programmatically, please use https://www.npmjs.com/package/cronitor-client

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
cronitor.pause('d3x0c1', 5) //pause for 5 hours
cronitor.fail('d3x0c1', 'not enough foo')
```

## Contributing

By participating in this project you agree to abide by the [Code of Conduct](http://contributor-covenant.org/version/1/3/0/)

Pull requests and features are happily considered.  Pull Requests are preferred to Issues, but if you have any questions, please do ask before you get too far.

## To contribute

Fork, then clone the repo:

    git clone git@github.com:your-username/cronitor-caller.git

Set up your machine:

    npm install

Make sure the tests pass:

    npm test

Make your change. Add tests for your change. Make the tests pass:

    npm test


Push to your fork and [submit a pull request]( https://github.com/bigethan/cronitor-caller/compare/)

At this point you're waiting on me. Some things that will increase the chance that your pull request is accepted:

* Write tests.
* Write a good commit message.

# License

The MIT License (MIT)

Copyright (c) 2016 Big Ethan

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
