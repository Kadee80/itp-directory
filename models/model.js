var moment = require('moment');
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

// define a schema
var PersonSchema = new Schema({
	netId: String,
	name: {firstName: String, lastName: String},
	year: String,
	description: String,
	location: String,
	photo: String, // url at amazon s3
	audio: String, // url at amazon s3
  dateAdded: {type: Date, default: moment},
  lastupdated : {type: Date, default: moment}
});


// export 'Person' model
module.exports = mongoose.model('Person',PersonSchema);