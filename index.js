const fs = require('fs');
const http = require('http');
var request = require('request');
//var request = require('request-promise');
const xml2js = require('xml2js');
const parser = xml2js.parseString;
const DOMParser = require('xmldom').DOMParser;
const q = require('q');


function main() {
    parseFile('alice-posts.xml', 2)
        .then(posts => {
            console.log('process alice posts');
            return submitPosts(posts);
        })
        .then(x => {
            console.log('read andy posts');
            return parseFile('andy-posts.xml', 1);
        })
        .then(posts => {
            console.log('process andy posts');
            return submitPosts(posts);
        })
        .then(result => {
            console.log('all posts submited.')
        });
}

function parseFile(fileName, channel) {
    return new Promise((resolve, reject) => {
        fs.readFile(__dirname + '/' + fileName, function (err, data) {
            if (err)
                console.log(err);

            parser(data, function (err, result) {
                if (err)
                    console.log(err);
                    
                var posts = [];
                for (var item of result.rss.channel[0].item) {

                    var post = {
                        Title: item.title[0],
                        Content: item['content:encoded'][0],
                        DateCreated: item['wp:post_date'][0],
                        DatePublished: item['wp:post_date'][0],

                        ReadCount: 1,
                        Rating: 1
                    };

                    var parser = new DOMParser();
                    var doc = parser.parseFromString(post.Content, "text/html");
                    let localImages = doc.getElementsByTagName("img");
                    let imageCount = localImages.length;
                    if (imageCount > 0) {
                        for (var i = 0; i < imageCount; i++) {
                            let image = localImages[0];
                            let src = image.getAttribute("src").toString();
                            if (src.startsWith('http')
                                && src.indexOf('sinaimg') < 0) {
                                post.SplashUrl = src;
                                break;
                            }
                        }
                    }
                    post.Slug = Slugify(item.title[0]);
                    post.ChannelId = channel;
                    posts.push(post);
                }

                resolve(posts);
            });
        });
    });

}
function submitPosts(posts) {
    var last = posts.reduce((task, post) => {
        return task.then(() => {
            return submitPost(post);
        });
    }, q.resolve());

    var deferred = q.defer();
    last.then(() => {
        console.log('Submit posts  finished');
        deferred.resolve();
    });
    return deferred.promise;
}
function submitPost(post) {
    var options = {
        uri: 'http://localhost:1971/api/post/update',
        method: 'POST',
        json: post
    };
    return new Promise((resolve, reject) => {
        request.post(options, (error, response, body) => {
            if (!error && response.statusCode == 200) {
                console.log(post.Title + ' is submited');
                resolve();
                // setTimeout(function () {

                // }, 1000);

            }
            else if (error) {
                console.log(error);
                reject(error);
            }
        });
    });
}
function Slugify(value) {
    if (!value || value.length <= 0)
        return value;

    let slug = value.toString()
        .toLowerCase()
        .replace(/\s+/g, '-')           // Replace spaces with -
        .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
        .replace(/\-\-+/g, '-')         // Replace multiple - with single -
        .replace(/^-+/, '')             // Trim - from start of text
        .replace(/-+$/, '');            // Trim - from end of text

    if (!slug || slug.length <= 0)
        slug = value;

    return slug;
}

main();