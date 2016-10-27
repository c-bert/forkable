require('dotenv').load();

var express = require('express'),
  app = express(),
  slackAPI = require('slackbotapi'),
  config = require('config.json')('./config.json');
var bodyParser = require("body-parser");

app.use(bodyParser.urlencoded({
  extended: false
}));
app.use(bodyParser.json());
app.set('port', (process.env.PORT || 5000));

const slackToken = process.env.SLACKTOKEN
const lunchChannelId = (process.env.NODE_ENV === 'testing') ? process.env.TESTING_CHANNEL_ID : process.env.CHANNEL_ID;
const twilioAccountSid = process.env.TWILIO_SID;
const twilioAuthToken = process.env.TWILIO_TOKEN;
var forkableDriverNumber;

var slackbot = new slackAPI({
  'token': slackToken,
  'logging': true,
  'autoReconnect': true,
  'name': 'LunchBot'
});

var slackEmoji = {
  icon_emoji: ':camchef:'
};
// Logging output for testing
if (process.env.NODE_ENV === 'testing') {
  slackbot.on('message', function(data) {
    if (data) {
      console.log(data);
    }
  });
}

var twilio = require('twilio');
var client = new twilio.RestClient(twilioAccountSid, twilioAuthToken);

app.post('/webhook/twilio/sms', function(req, res) {
  forkableDriverNumber = req.body.From;
  slackbot.sendMsg(lunchChannelId, 'Forkable Driver: ' + req.body.Body.toString() + '\nFrom Number: ' + forkableDriverNumber, slackEmoji);
  var twiml = new twilio.TwimlResponse();
  console.log(lunchChannelId)
  res.writeHead(200, {
    'Content-Type': 'text/xml'
  });
  res.end(twiml.toString());
});

app.post('/webhook/twilio/voice', function(req, res) {
  var call = req.body;
  forkableDriverNumber = call.From;
  var twiml = new twilio.TwimlResponse();
  var Notifiees = [];
  for (var i = 0; i < config.PeopleToNotify.length; i++) {
    twiml.dial('number', config.PeopleToNotify[i].Number);
    Notifiees.push(config.PeopleToNotify[i].Name)
  }
  slackbot.sendMsg(lunchChannelId, 'Forkable Driver is Calling \n Forwarding to ' + Notifiees.toString() + '\n Call from: ' + forkableDriverNumber, slackEmoji);
  console.log(twiml.toString())
  res.writeHead(200, {
    'Content-Type': 'text/xml'
  });
  res.end(twiml.toString());
});

slackbot.on('message', function(data) {
  if (data.type === "message") {
    var message = data.text;
    if (message === undefined) {
      return;
    }
    message = message.toLowerCase();
    if (data.channel === lunchChannelId) {
      if (message.substring(0, 12) === 'lunchbot sms') {
        var reply = data.text.substring(12);
        client.messages.create({
          to: forkableDriverNumber,
          from: config.TwilioNumber,
          body: reply
        }, function(err, message) {
          if (err) {
            if(err.code === 21604){
                slackbot.sendMsg(lunchChannelId, "Sorry I don't know who to text, a little brain dead right now.", slackEmoji);
            }
          } else {
            console.log(message.sid);
          }
        });
      }
    }
  }
});

app.listen(app.get('port'), function() {});
