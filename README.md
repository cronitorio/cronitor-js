# Cronitor Ping and Monitor API Client

[![Travis Build](https://img.shields.io/travis/bigethan/cronitor-caller/master.svg)](https://travis-ci.org/bigethan/cronitor-caller)
[![Coveralls](https://img.shields.io/coveralls/bigethan/cronitor-caller/master.svg)](https://coveralls.io/github/bigethan/cronitor-caller?branch=master)
![dependencies](https://img.shields.io/badge/dependencies-NONE!-brightgreen.svg)

Cronitor is a service for heartbeat-style monitoring of anything that can send an HTTP request. It's particularly well suited for monitoring cron jobs, node-cron, or any other background task.

This library provides a simple abstraction for performing monitor CRUD operations as well as light weight interface for integrating cronitor into your Javascript project. For a better understanding of the APIs this library talks to please see our [Ping API docs](https://cronitor.io/docs/ping-api) and [Monitor API docs](https://cronitor.io/docs/monitor-api). For a general introduction to Cronitor please read [How Cronitor Works](https://cronitor.io/docs/how-cronitor-works).

## Installation

`npm install cronitor`

## Usage

### Ping an existing monitor
```javascript
var Cronitor = require('cronitor')

// create new object with monitor's unique code
const cronitor = new Cronitor({code: 'd3x0c1'})

// api matches cronitor's
cronitor.run()
cronitor.complete()
cronitor.pause(5) //pause for 5 hours
cronitor.unpause()
cronitor.fail("Hard Fail") // all methods accept an optional message

// if authenticated pings are enabled add your authKey like so
const cronitor = new Cronitor({code: 'd3x0c1', authKey: 'xxxxxx'})
cronitor.run("My auth key is used to authenticate requests")
```

### Create a new monitor

```javascript
var Cronitor = require('cronitor')

// instantiate with a monitorApiKey (https://cronitor.io/settings#account)
const cronitor = new Cronitor({monitorApiKey: 'xxxxxx'})

// sugar syntax for creating a new cron monitor
cronitor.createCron({
    name: 'Nightly DB Backup',
    expression: '0 0 * * *',
    notificationLists: ['devops-pagerduty'] // optional. account default will be used if omitted.
})

// sugar syntax for creating a new heartbeat monitor (and immediately pinging it)
cronitor.createHeartbeat({
    name: 'Queue Worker Heartbeat',
    every: [60, 'seconds']
}).then((monitor) => {
    // all CRUD methods return a Promise object.
    // resolve method is passed a POJO representing the monitor
    console.log(monitor.code) // d3x0c1
    // creating a monitor will also set the code on this object and allow you to immediately ping it
    cronitor.run("My first ping!")
})


// create any type of monitor.
// pass an object that adheres to the Monitor v3 API specification (https://cronitor.io/docs/monitor-api)
// this is equivalent to the first example above
cronitor.create({
    type: 'cron'
    name: 'Nightly DB Backup',
    rules: [
        {
            rule_type: 'not_on_schedule',
            value: '0 0 * * *',
        }
    ],
    notifications: {
        templates: ['devops-pagerduty']
    }
}).then((monitor) => {
    console.log(monitor.name) // 'Nightly DB Backup'
})

```

### Additional methods

```javascript

var Cronitor = require('cronitor')
const cronitor = new Cronitor({monitorApiKey: 'xxxxxx', code: 'd3x0c1'})

// Update existing attributes on a monitor
cronitor.update({name: 'Midnight UTC DB Backup'}).then((monitor) => {
    console.log(monitor.name) // 'Midnight UTC DB Backup'
})

// delete a monitor
cronitor.delete()

// does not require a code
cronitor.filter({page: 2}).then((res) => {
    console.log(res.total_monitor_count) // 83
    console.log(res.page) // 2
    console.log(res.monitors.length) // 33
})

```


## Contributing

By participating in this project you agree to abide by the [Code of Conduct](http://contributor-covenant.org/version/1/3/0/)

Pull requests and features are happily considered.  Pull Requests are preferred to Issues, but if you have any questions, please do ask before you get too far.

## To contribute

Fork, then clone the repo:

    git clone git@github.com:your-username/cronitor.git

Set up your machine:

    npm install

Make sure the tests pass:

    npm test
    
Make your change. Add tests for your change. Make the tests pass:

    npm test


Push to your fork and [submit a pull request]( https://github.com/cronitorio/cronitor-js/compare/)

