
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

/*
	GET /
*/
exports.get12 = function(req, res) {
	
		var viewData = {
			pageTitle : "ITPortraits"
		}	
	res.render('12frame.html', viewData);

}

exports.get9 = function (req,res){
		var viewData = {
			pageTitle : "ITPortraits"
		}	
	res.render('9frame.html', viewData);
}

exports.add = function(req,res){
	console.log('adding a gif page');

	var viewData = {
		pageTitle: "Animated Portrait"
	}

	res.render('add.html',viewData);
}

exports.saveDescriptionToDb = function(req,res){

	var netId = req.body.userId;
	var location = req.body.location;

  // now update the user
  Person.findOneAndUpdateQ({netId:netId}, { $set: {location:location}})
  .then(function(response){
    console.log('user updated! ' + response);
    res.json({status:'success'}); 
  })
  .fail(function (err) { 
  	console.log('error in updating user! ' + err)
  	res.json(err); 
  })
  .done();	

}

exports.savePhotoToDb = function(req,res){
	console.log('saving gif to db');

	var netId = req.body.userId;
	var filename = new Date().getTime().toString()+ '.gif' // for now, file name is just the time stamp
	var mimeType = 'image/gif';
	var filepath = "temp/"+filename; // will write file to temp folder below
	var originalGif = req.body.image_gif;

	// make it into a proper gif that we can save to db
	var base64Data = originalGif.replace(/^data:image\/gif;base64,/, "");
	require("fs").writeFile(filepath, base64Data, 'base64', function(err) {
	  if (err && err != 'null') console.log(err);
	  // now, save that new file to Amazon S3
	  // We first need to open and read the image into a buffer
	  fs.readFile(filepath, function(err, file_buffer){

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
	          var dataToSave = {photo: process.env.AWS_S3_PATH + filename};

	          // // TODO - we shouldn't hard code the url like this, but instead should get a temp URL dynamically using aws-sdk
	          // // i.e. every time there's a request, at that point we get the temp URL by requesting the filename
	          // // see 'getObject' at http://docs.aws.amazon.com/AWSJavaScriptSDK/guide/node-examples.html

	          // now update the user
	          Person.findOneAndUpdateQ({netId:netId}, { $set: dataToSave})
	          .then(function(response){
	            console.log('user updated! ' + response);
	            res.json({status:'success'}); 
	          })
	          .fail(function (err) { 
	          	console.log('error in updating user! ' + err)
	          	res.json(err); 
	          })
	          .done();            
	        }

	      });

	    });
	});
}

exports.getUser = function(req,res){
	var netId = req.param('id');

  Person.findOneQ({netId:netId})
  .then(function(response){
  	if (response == null) var dataToReturn = {status: 'failed'};
  	else {
	  	var dataToReturn = {
	  		user: response,
	  		status: 'success'
	  	}
	  }
    res.json(dataToReturn); 
  })
  .fail(function (err) { 
  	var dataToReturn = {
  		status: 'failed'
  	}
    res.json(dataToReturn);
  })
  .done();	
}

// gets the users and chooses 9 at random
// this works because the dataset is small. would need a better way to get random docs if a larger dataset
exports.getUsers = function(req,res){

	var requestNum = req.param('num');

	console.log('getting '+requestNum+' users');

	Person.findQ({photo: {'$ne': '' }})
	.then(function(response){
		// choose 9 at random
		var ranNumArray = new Array();
		for(var i=0;i<requestNum;i++){
			ranNumArray.push(getRanNum());
		}

		// get a random number, ensuring there are no duplicates
		function getRanNum(){
			 // get a random number between 0 and the document array length 
			 var ranNum = Math.floor((Math.random() * response.length) + 0);
			 // if ranNum is already in the array of chosen numbers, getRanNum again
			 if (!response[ranNum] || response[ranNum] == 'null') getRanNum(); // if null, calls the function again
			 if (checkDuplicates(ranNum,ranNumArray)) getRanNum(); // if duplicated, calls the function again
			 if (!response[ranNum] || response[ranNum] == 'null') getRanNum(); // if null, calls the function again
			 else return ranNum;
		}	

		function checkDuplicates(num,arr){
			for(var i=0;i<arr.length;i++){
				if(num == arr[i]) {
					return true;
					break;
				}
			}
			return false;
		}

		// move on to returning the data
		var arrayToReturn = new Array();
		for(var i=0;i<requestNum;i++){
			arrayToReturn.push(response[ranNumArray[i]]);
		}
		var dataToReturn = {'students': arrayToReturn};
		//respond back with the data
  	res.json(dataToReturn);
  })
  .fail(function (err) { 
  	var dataToReturn = {status: 'failed'}
    res.json(dataToReturn);
  })
  .done();	
}

//// TESTING / UTILITY ROUTES - not used in production //

exports.addPhotos = function(req,res){

	var gifList = ['https://s3.amazonaws.com/digitalpolaroids/1414603562424.gif',
	'https://s3.amazonaws.com/digitalpolaroids/1414602635356.gif',
	'https://s3.amazonaws.com/digitalpolaroids/1414437551984.gif',
	'https://s3.amazonaws.com/digitalpolaroids/1414598776220.gif',
	'https://s3.amazonaws.com/digitalpolaroids/1414176903720.gif',
	'https://s3.amazonaws.com/digitalpolaroids/1414437380389.gif',
	'https://s3.amazonaws.com/digitalpolaroids/1414432816988.gif'];


	Person.find(function(err,data){

		for(var i=0;i<data.length;i++){
			var ranNum = Math.floor((Math.random() * (gifList.length)) + 0);
		  var dataToSave = {photo: gifList[ranNum],description: 'My name is '+data[i].name.firstName+' and this is just a random description for testing purposes!'};

		    Person.update({_id:data[i]._id},{$set: dataToSave}, function (err,data) {
		        if (err) {
		            console.log(err);
		        }
		        else {
		        	console.log(data);
		        }
			});
		}

		console.log('done');
	});

}

exports.updateInfo = function(req,res){

	Person.find(function(err,data){

		for(var i=0;i<data.length;i++){

				var dataToSave = {
					description: "",
					location: "",
					photo: ""
				}

		    Person.update({_id:data[i]._id},{$set: dataToSave}, function (err,data) {
		        if (err) {
		            console.log(err);
		        }
		        else {
		        	console.log(data);
		        }
			});
		}

		console.log('done');
	});

}

exports.getEmails = function(req,res){
	Person.find(function(err,data){

		var emailList;

		for(var i=0;i<data.length;i++){

			if (data[i].photo == "") emailList += data[i].netId+"@nyu.edu,"
		}

		fs.writeFile('emails.csv', emailList, function (err) {
		  if (err) throw err;
		  console.log('It\'s saved!');
		});
	});

}

exports.createUsers = function(req,res){
	
	var csv = require('fast-csv');

	var stream = fs.createReadStream("all-students-20141024.csv");

	var csvStream = csv()
    .on("data", function(data){
         var netId = data[0];
         var firstName = data[1];
         var lastName = data[2];
         var year = data[3];

         var dataToSave = {
         	netId: netId,
         	name: {firstName: firstName, lastName: lastName},
         	year: year
         }

         var person = Person(dataToSave);

         // save the person to db
         person.saveQ()
				 .then(function (response){ 
				 	console.log(response);
				  })
				  .fail(function (err) { console.log(err); })
				  .done();         
		    })
	    .on("end", function(){
	         console.log("done");
    });

    stream.pipe(csvStream);

}