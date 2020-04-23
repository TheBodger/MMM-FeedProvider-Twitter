# MMM-FeedProviderTwitter
MagicMirror module that gathers tweets and provides them to a consumer module to display 

example config entry

```
		{
			module: 'MMM-FeedProvider-Twitter',
			config: {
				consumerids: ['MMFD1',], // the unique id of the consumer(s) to listen out for
				id: "MMFP1", //the unique id of this provider
				// visit the url below for the twitter keys/tokens
				// https://dev.twitter.com/oauth/overview/application-owner-access-tokens
				consumer_key: '',
				consumer_secret: '',
				access_token_key: '',
				access_token_secret: '',
				feeds: [
					{ feedname: 'TKMaxx', feedtitle: 'TKMaxx', searchHashtag: 'TKMaxx OR Homesense OR TJX', oldestage: '2020-04-01 00:00:01' },
					{ feedname: 'Models', feedtitle: 'Models', searchHashtag: 'Models', oldestage: '2020-04-01 00:00:01' },
					{ feedname: 'BBCsport', feedtitle: 'BBCsport', searchHashtag: '#BBCsport', oldestage: 60 * 24 },
					{ feedname: 'BBCNews', feedtitle: 'BBCNews', searchHashtag: '#BBCnews', oldestage: 60 * 24 },
				],
				maxTweetAgeMins: 360 * 15,
				totalTweetsPerUpdate: 50,
				excludeRetweets: false,
				language: "en",
			}
		},



```
