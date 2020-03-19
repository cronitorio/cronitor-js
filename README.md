# Cronitor Ping API Client

[![Travis Build](https://img.shields.io/travis/bigethan/cronitor-caller/master.svg)](https://travis-ci.org/bigethan/cronitor-caller)
[![Coveralls](https://img.shields.io/coveralls/bigethan/cronitor-caller/master.svg)](https://coveralls.io/github/bigethan/cronitor-caller?branch=master)
![dependencies](https://img.shields.io/badge/dependencies-NONE!-brightgreen.svg)

Cronitor is a service for heartbeat-style monitoring of anything that can send an HTTP request. It's particularly well suited for monitoring cron jobs, node-cron, or any other background task.

This is a dependency free module to provide a simple abstraction for the pinging of a monitor. For a better understanding of the API this library talks to, please see our [Ping API docs](https://cronitor.io/docs/ping-api). For a general introduction to Cronitor please read [How Cronitor Works](https://cronitor.io/docs/how-cronitor-works).

If you want to
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

