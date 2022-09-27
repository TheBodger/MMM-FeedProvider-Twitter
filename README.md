# MMM-FeedProvider-Twitter Module

This magic mirror module is a MMM-FeedProvider module that is part of the the MMM-Feedxxx interrelated modules. 

For an overview of these modules see the README.md in https://github.com/TheBodger/MMM-FeedDisplay.

the -Twitter module will monitor and format any Tweets it is configured to search for. It will extract text and the first Image that is embbeded within a tweet.

### Example
![Example of MMM-FeedProvider-Twitter output](images/screenshot.png?raw=true "Example screenshot")

### Dependencies

Before installing this module, use https://github.com/TheBodger/MMM-FeedUtilities to setup the MMM-Feed... dependencies and  install all modules 

The following node modules are required: See https://github.com/TheBodger/MMM-FeedUtilities for a simple install process for all MMM-Feedxxx modules and dependencies

```
moment
twitter
```

## Installation
To install the module, use your terminal to:
1. Navigate to your MagicMirror's modules folder. If you are using the default installation directory, use the command:<br />`cd ~/MagicMirror/modules`
2. Clone the module:<br />`git clone https://github.com/TheBodger/MMM-FeedProvider-Twitter`

## Using the module

### Authorisation (as at time of writing)

This stackoverflow post (Getting new Twitter API consumer and secret keys - https://stackoverflow.com/questions/1808855/getting-new-twitter-api-consumer-and-secret-keys) gives a good overview of how to setup and obtain the neccessary keys to enable this module to function.

When your create your project, you need to upgrade it to an elavated level. If the project is left as its default essential level, then the module wont work and returns no data nor errors. If you have already generated keys before elevating the project, revoke all keys, then regenerate each set in turn once twitter has granted you elevated status.

### MagicMirror² Configuration

To use this module, add the following configuration block to the modules array in the `config/config.js` file:
```js

		{
			module: "MMM-FeedProvider-Twitter",
			config: {
				id: "mmfp-Twitter",
				consumerids: ["MMFD1"],
				// visit the url below for obtaining the twitter keys/tokens required below
				// https://dev.twitter.com/oauth/overview/application-owner-access-tokens
				consumer_key: 'your consumer key',
				consumer_secret: 'your consumer secret',
				access_token_key: 'your token key',
				access_token_secret: 'your token secret ',
				maxTweetAgeMins: 360 * 15,
				totalTweetsPerUpdate: 50,
				excludeRetweets: false,
				language: "en",
				feeds: [
					{ feedname: 'BBCsport', 
						feedtitle: 'BBCsport', 
						searchHashtag: '#BBCsport OR @BBC OR ITV', 
						oldestage: 'today' },
				],
			}
		},

```

### Configuration Options

| Option                  | Details
|------------------------ |--------------
| `text`                | *Optional* - <br><br> **Possible values:** Any string.<br> **Default value:** The Module name
| `consumerids`            | *Required* - a list of 1 or more consumer modules this module will provide for.<br><br> **Possible values:** An array of strings exactly matching the ID of one or more MMM-FeedDisplay modules <br> **Default value:** none
| `id`         | *Required* - The unique ID of this provider module<br><br> **Possible values:** any unique string<br> **Default value:** none
| `consumer_key`         | *Required* - A Twitter provided authentication key<br><br> **Possible values:** see the URL above to create a key<br> **Default value:** none
| `consumer_secret`         | *Required* - A Twitter provided authentication secret<br><br> **Possible values:** see the URL above to create a secret<br> **Default value:** none
| `access_token_key`         | *Required* - A Twitter provided authentication key<br><br> **Possible values:** see the URL above to create a key<br> **Default value:** none
| `access_token_secret`         | *Required* - A Twitter provided authentication secret<br><br> **Possible values:** see the URL above to create a secret<br> **Default value:** none
| `datarefreshinterval`            | *Optional* - milliseconds to pause before checking for new data in the feeds.<br><br> **Possible values:** a number in milliseconds <br> **Default value:** `300000` 
| `Filters`            |
| `totalTweetsPerUpdate`            | *Optional* - The number of tweets to pull during each update<br><br> **Possible values:** a number (max 100)<br> **Default value:** `25` 
| `excludeTweetsWithQuotes`            | *Optional* - exclude any tweets with quotes<br><br> **Possible values:** `true`,`false`<br> **Default value:** `false` 
| `excludeRetweets`            | *Optional* - exclude any retweeted tweets (RT in title)<br><br> **Possible values:** `true`,`false`<br> **Default value:** `true` 
| `excludeMediaTweets`            | *Optional* - exclude any tweets containing media (images,video etc)<br><br> **Possible values:** `true`,`false`<br> **Default value:** `false` 
| `excludeLinkTweets`            | *Optional* - exclude any tweets that are a link to other tweets<br><br> **Possible values:** `true`,`false`<br> **Default value:** `false` 
| `excludeTweetLengthLessThan`            | *Optional* - exclude any tweets that are a shorter than this number<br><br> **Possible values:** any number<br> **Default value:** `16` 
| `excludeTweetsWithoutText`            | *Optional* - exclude any tweets that dont contain the words in this array<br><br> **Possible values:** an array of words<br> **Default value:** empty 
| `language`            | *Optional* - include tweets that match this language only<br><br> **Possible values:** any language string<br> **Default value:** empty (all languages) 
| `feeds`        | *required* - See below for the feed format
| `waitforqueuetime`            |*Ignore* -  Queue delay between ending one queue item and starting the next <br><br> **Possible values:** a number in milliseconds. <br> **Default value:** `10`
| `Feed Format`            |
| `feedname`            |*Required* -  Name of the feed for reference purposes.<br><br> **Possible values:** Any unique string. <br> **Default value:** none
| `feedtitle`            |*Required* -  Title of the feed for reference purposes.<br><br> **Possible values:** Any unique string. <br> **Default value:** none
| `searchHashtag`            |*Required* -  search term to use to find tweets (can include a leading# or @) <br><br> **Possible values:** any search string, hashtag or named tweet, can include OR to provide multiple terms.<br> **Default value:** none
| `oldestage`            |*Required* -  Filter out any articles older than this "age" (As defined by the pubdate in the Twitter feed). <br><br> **Possible values:** 'today' or a number of minutes or a valid date(See [Moment.js formats](http://momentjs.com/docs/#/parsing/string-format/). <br> **Default value:** none


### Additional Notes

View the examples to see how to use different search terms.

This is a WIP; changes are being made all the time to improve the compatability across the modules. Please refresh this and the MMM-feedUtilities modules with a `git pull` in the relevant modeules folders.
