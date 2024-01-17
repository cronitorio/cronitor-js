const Parser = require('rss-parser');
const cronitor = require('../lib/cronitor')('fakeApiKey');
const parser = new Parser();

const event = new cronitor.Event('monitor-key');

async function init() {
    let currStatus = status = await checkGithubStatus();
    while (true) {
        status = await checkGithubStatus();
        if (currStatus !== status) {
            await sendStatusAlert(status);
            currStatus = status;
        } else {
            console.log('No new incident');
        }

        await sleep(1);
        event.tick();
    }
} init();

async function checkGithubStatus() {
    const feed = await parser.parseURL('https://www.githubstatus.com/history.rss');
    return feed.items[0]['title'];
}

function sleep(seconds) {
    return new Promise(resolve => setTimeout(resolve, (seconds * 1000)));
}

function sendStatusAlert(status) {
    // simulate network call
    return new Promise(resolve => setTimeout(resolve, 100)).then(() => console.log(`New Incident! ${status}`));
}
