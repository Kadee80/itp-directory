
/*
 * routes/routes.js
 * 
 * Routes contains the functions (callbacks) associated with request urls.
 */

var request = require('request'); // library to make requests to remote urls
var Q = require('q'); // library for javascript promises

var moment = require("moment"); // date manipulation library
var Person = require("../models/model.js"); //db model

// S3 File dependencies
var fs = require('fs');
var AWS = require('aws-sdk');
var awsBucketName = process.env.AWS_BUCKET_NAME;
var s3Path = process.env.AWS_S3_PATH; // TODO - we shouldn't hard code the path, but get a temp URL dynamically using aws-sdk's getObject
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_KEY
});
var s3 = new AWS.S3();

/**
 * Returns a message that the API is up and going
 * @return {JSON}
 */

exports.index = function(req, res) {
	
	var data = {
		status : "OK",
		message : "ITPDirectory API"
	}	
	
	res.json(data);
}

/**
 * Returns all the students
 * @param  {String} skip Optional. How many students to skip. Good for paging.
 * @param  {String} limit Optional. How many students to return. Good for paging.
 * example /api/students?skip=12&num=12
 * @return {JSON}
 */

exports.getAll = function (req,res){


	var skip, limit;

	if (req.param('skip')) skip = req.param('skip');
	if (req.param('limit')) limit = req.param('limit');

  Person.find().skip(skip).limit(limit).execQ()
  .then(function(response){
  	var data = {
  		status: 'OK',
  		data: response
  	}
    res.json(data); 
  })
  .fail(function (err) { 
  	console.log('error in getting users! ' + err)
  	var data = {
  		status: 'ERROR',
  		error: err
  	}  	
  	res.json(data); 
  })
  .done();	
}


/**
 * Returns one student
 * @param  {String} id REQUIRED. The id of the student to retrieve.
 * example /api/student/sjs663
 * @return {JSON}
 */

exports.getOne = function (req,res){

	var requestedId = req.param('id');
	if(!requestedId) res.json({status:'ERROR',error:'An id is required'})

  Person.findOneQ({netId:requestedId})
  .then(function(response){
  	if(response==null) res.json({status:'ERROR',error:'No id is associated with that student'})
  	var data = {
  		status: 'OK',
  		data: response
  	}
    res.json(data); 
  })
  .fail(function (err) { 
  	console.log('error in getting users! ' + err)
  	var data = {
  		status: 'ERROR',
  		error: err
  	}  	
  	res.json(data); 
  })
  .done();	
}

/**
 * Updates a student
 * @param  {req.body} OBJECT. 
 * requires a netId {req.body.netId} and an audio file {req.files.audio}
 * initially, just an audio file, eventually could update any/all student data
 * @return {JSON}
 */

exports.update = function(req,res){

	console.log('saving audio to db');
  console.log(req);
  
	var netId = req.body.netId;

	var originalFile = req.files.file.name.replace(/\s+/g, '-').toLowerCase();
  var mimeType = req.files.file.type; // image/jpeg or actual mime type
	var filename = netId + "_audio_" + new Date().getTime().toString()+ originalFile;
  var path = req.files.file.path; // will be put into a temp directory

  fs.readFile(path, function(err, file_buffer){

  // save the file_buffer to our Amazon S3 Bucket
  	var s3bucket = new AWS.S3({params: {Bucket: awsBucketName}});

  	// Set the bucket object properties
  	// Key == filename
  	// Body == contents of file
    // ACL == Should it be public? Private?
    // ContentType == MimeType of file ie. image/jpeg.
    var params = {
      Key: filename,
      Body: file_buffer,
      ACL: 'public-read',
      ContentType: mimeType
    };
      
    // Put the Object in the Bucket
    s3bucket.putObject(params, function(err, data) {
      if (err) {
      	console.log(err)
        } else {
          console.log("Successfully uploaded data to s3 bucket");

          // add or update user image
          var dataToSave = {
          	audio: {
	          	s3url: process.env.AWS_S3_PATH + filename,
	          	filename: filename
          	}
          };

          // now update the user
          Person.findOneQ({netId:netId})
          .then(function(response){
          	if(response.audio) deleteAudio(response.audio.filename);
          	return Person.findOneAndUpdateQ({netId:netId}, { $set: dataToSave})
          })
          .then(function(response){
				  	var data = {
				  		status: 'OK',
				  		data: response
				  	}
				    res.json(data);  
          })
          .fail(function (err) { 
          	console.log('error in updating user! ' + err)
				  	var data = {
				  		status: 'ERROR',
				  		error: err
				  	}  	
				  	res.json(data); 
          })
          .done();            
        }

      });

    });

    function deleteAudio(audio){
      // delete from S3
      s3.client.deleteObject({Bucket: awsBucketName, Key: audio}, function(err, data) {
        if(err) console.log(err);
      });    
    }
}
