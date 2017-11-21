// Mongo
var MongoClient = require('mongodb').MongoClient, assert = require('assert');
var mongourl = 'mongodb://localhost:27017/dcrobserver';
var db;

// File system
var fs = require('fs');
var savefile = "../../../dcr_mongo_loader_savefile.json";
var blockdir = '../../../blocks/';

// Use connect method to connect to the server
MongoClient.connect(mongourl, function(err, db_response) {
	assert.equal(null, err);
	console.log("Connected successfully to server");

	// Set global
	db = db_response;

	// If we have a save state, use it
	fs.exists(savefile, function(exists) {
		if (!exists) {
			createCollections(processBlock);
		} else {
			console.log("Using save state.");
			fs.readFile(savefile, function(err, data) {
				if (err) {
					console.log("Could not read save state file.");
					process.exit();
				} else {
					// Pull the save state and restore
					var save_state = JSON.parse(data);

					// Report height
					console.log("Starting at height " + save_state.height + ".");

					// Now process the blocks
					processBlock(save_state.height);
				}
			});
		}
	});

	// HA
	//db.close();
});

function createCollections(callback) {
	db.createCollection("block");
	db.collection("block").createIndex({ "hash": 1 }, { unique: true }, callback);
}

function processBlock(height) {
	if (!height) {
		height = 1;
	}

	// Send heartbeats occasionally
	if (height%5000==0) {
		console.log("hrtbt@" + height);
	}

	// End when we hit a terminating requirement
	if (height%50000==0) {
		saveProgress(height);
		db.close();
		process.exit();
	}

	// Produce the mongo inserts for this height, then call again to continue
	produceMongoInserts(height, processBlock);
}

function saveProgress(height) {
	console.log("At height " + height + ". Saving state.");
	fs.writeFileSync(savefile, JSON.stringify({'height' : height}));
}

function produceMongoInserts(height, callback) {
	// Collect the block
	var blocksubdir = "blocks_" + (Math.trunc(height/1000)*1000) + "_" + (Math.trunc(height/1000)*1000 + 999) + "/";
	var location = blockdir + blocksubdir + "block_" + height + ".json";

	// Validate that we have a file for this block
	if (!fs.existsSync(location)) {
		return null;
	}

	// Collect all transactions
	var block = JSON.parse(fs.readFileSync(location));

	// Form the block
	var mongo_block = {
		'hash':        block.hash,
		'height':      block.height,
		'time':        block.time,
		'votebits':    block.votebits,
		'voters':      block.voters,
		'freshstake':  block.freshstake,
		'revocations': block.revocations,
		'poolsize':    block.poolsize,
		'bits':        block.bits,
		'sbits':       block.sbits,
		'tx' :         []
	};

	// For both trees..
	for (var tree_branch = 0; tree_branch < 2; tree_branch++)
	{
		var rawtxes;
		if (tree_branch == 0) {
			// Normal transactions
			rawtxes = block["rawtx"];
		} else {
			// Stake transactions
			rawtxes = block["rawstx"];
		}

		// For all transactions, keep tabs on who's paying and who's receiving
		for (var i = 0; i < rawtxes.length; i++) {
			// Get information about the transaction
			var tx = rawtxes[i];

			// Add tx
			var mongo_tx = {
				'hash' : tx.txid,
				'tree' : tree_branch,
				'blockindex' : i,
				'locktime' : tx.locktime,
				'expiry' : tx.expiry,
				'vin' : [],
				'vout' : []
			};

			// Get the incoming amounts
			for (var j = 0; j < tx.vin.length; j++) {
				var vin = tx.vin[j];

				// Push vin to tx
				mongo_tx.vin.push({
					'amountin' : vin.amountin,
					'blockheight' : vin.blockheight,
					'tree' : vin.tree || '',
					'blockindex' : vin.blockindex,
					'vout' : vin.vout || '',
					'coinbase' : vin.coinbase || '',
					'stakebase' : vin.stakebase || ''
				});
			}

			// Get the outgoing amounts & addresses
			for (var j = 0; j < tx.vout.length; j++) {
				var vout = tx.vout[j];

				if (!vout.hasOwnProperty('scriptPubKey')) { 
					vout.scriptPubKey = {type : '', reqSigs : ''};
				}

				// Construct vout
				var mongo_vout = {
					'value' : vout.value || 0,
					'commitamt' : vout.commitamt || 0,
					'n' : vout.n,
					'type' : vout.scriptPubKey.type || '',
					'reqSigs' : vout.scriptPubKey.reqSigs || '',
					'addresses' : []
				};

				if (tx.vout[j].scriptPubKey.hasOwnProperty('addresses')) {
					for (var k = 0; k < tx.vout[j].scriptPubKey.addresses.length; k++) {
						var address = tx.vout[j].scriptPubKey.addresses[k];
						
						// Add address to vout
						mongo_vout.addresses.push(address);
					}
				}

				// Push vout to tx
				mongo_tx.vout.push(mongo_vout);
			}

			mongo_block.tx.push(mongo_tx);
		}
	}

	// Insert the block into Mongo & move on to next block
	db.collection('block').insertOne(mongo_block, function(err, data) {
		if (!err) {
			callback.call(this, height+1);
		} else {
			console.log(err);
			process.exit();
		}
	});
}
