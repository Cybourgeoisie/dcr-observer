var fs = require('fs');

var savefile = "../../../dcr_db_loader_savefile.json";
var blockdir = '../../../blocks/';

// If we have a save state, use it
fs.exists(savefile, function(exists) {
	if (!exists) {
		processBlocks(1);
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
				processBlocks(save_state.height);
			}
		});
	}
});

function processBlocks(height) {
	var next_height = height;
	while (next_height) {
		height = next_height;
		if (height%1000==0) {
			console.log("hrtbt@" + next_height);
		}

		/*
		if (height%8500==0) {
			console.log("Reached end.");
			saveProgress(height);
			process.exit();
		}
		//*/

		next_height = produceDbInserts(height);
	}

	// Save the final state
	console.log("Reached end.");
	saveProgress(height);
}

function saveProgress(height, next_block_hash) {
	console.log("At height " + height + ". Saving state.");
	fs.writeFileSync(savefile, JSON.stringify({'height' : height}));
}

function produceDbInserts(height) {
	// Collect the block
	var blocksubdir = "blocks_" + (Math.trunc(height/1000)*1000) + "_" + (Math.trunc(height/1000)*1000 + 999) + "/";
	var location = blockdir + blocksubdir + "block_" + height + ".json";

	// Validate that we have a file for this block
	if (!fs.existsSync(location)) {
		return null;
	}

	// Collect all transactions
	var block_json = fs.readFileSync(location);
	var block = JSON.parse(block_json);

	// Mark some memory up for GC
	block_json = null; delete block_json;

	// Prep for the inserts
	var db_inserts = 'BEGIN;';

	// Insert the block
	db_inserts += 'INSERT INTO block("hash", "height", "time", "version", "merkleroot", "stakeroot", ';
	db_inserts += '"stakeversion", "extradata", "votebits", "finalstate", "voters", "freshstake", ';
	db_inserts += '"revocations", "poolsize", "bits", "sbits") VALUES (';
	db_inserts += '\'' + block.hash + '\',' + block.height + ',' + 'TO_TIMESTAMP(' + block.time + '), ';
	db_inserts += block.version + ',' + '\'' + block.merkleroot + '\',';
	db_inserts += '\'' + block.stakeroot + '\',' + block.stakeversion + ',';
	db_inserts += '\'' + block.extradata + '\',' + '\'' + block.votebits + '\',';
	db_inserts += '\'' + block.finalstate + '\',' + block.voters + ',';
	db_inserts += block.freshstake + ',' + block.revocations + ',' + block.poolsize + ',';
	db_inserts += '\'' + block.bits + '\',' + '\'' + block.sbits + '\'); ';

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

			// Add the transaction
			db_inserts += 'INSERT INTO tx ("block_id","hash","tree","blockindex","version","locktime","expiry") ';
			db_inserts += 'SELECT block.block_id, \'' + tx.txid + '\',' + tree_branch + ',' + i + ',' + tx.version + ',' + tx.locktime + ',' + tx.expiry + ' ';
			db_inserts += 'FROM block WHERE block.height = ' + block.height + ';';

			// Get the incoming amounts
			var b_has_stakebase = false;
			for (var j = 0; j < tx.vin.length; j++) {
				var vin = tx.vin[j];

				// Set defaults if not provided
				if (!vin.hasOwnProperty('tree')) vin.tree = 'NULL';
				if (!vin.hasOwnProperty('vout')) vin.vout = 'NULL';

				if (vin.hasOwnProperty('stakebase')) {
					b_has_stakebase = true;
				}

				// Pull from a pre-existing vout if we can
				if (!vin.hasOwnProperty('coinbase') && !vin.hasOwnProperty('stakebase')) {
					// Craft the vout key -- ("{blockheight}-{tree}-{blockindex}-{n}")
					var vout_key = vin.blockheight + '-' + vin.tree + '-' + vin.blockindex + '-' + vin.vout;

					// Defaults following the coinbase / stakebase check
					if (!vin.hasOwnProperty('coinbase')) vin.coinbase = '';
					if (!vin.hasOwnProperty('stakebase')) vin.stakebase = '';

					db_inserts += 'INSERT INTO vin ("tx_id", "vout_id", "amountin", "blockheight", "tree", "blockindex", "vout", "coinbase", "stakebase", "sequence") ';
					db_inserts += 'SELECT tx.tx_id, vout.vout_id, ' + vin.amountin + ',' + vin.blockheight + ',' + vin.tree + ',' + vin.blockindex + ',' + vin.vout + ',\'' + vin.coinbase + '\',\'' + vin.stakebase + '\',' + vin.sequence + ' ';
					db_inserts += 'FROM tx JOIN vout ON vout.key = \'' + vout_key + '\' WHERE tx.hash = \'' + tx.txid + '\';';
				} else {
					// Defaults following the coinbase / stakebase check
					if (!vin.hasOwnProperty('coinbase')) vin.coinbase = '';
					if (!vin.hasOwnProperty('stakebase')) vin.stakebase = '';

					db_inserts += 'INSERT INTO vin ("tx_id", "amountin", "blockheight", "tree", "blockindex", "vout", "coinbase", "stakebase", "sequence") ';
					db_inserts += 'SELECT tx.tx_id, ' + vin.amountin + ',' + vin.blockheight + ',' + vin.tree + ',' + vin.blockindex + ',' + vin.vout + ',\'' + vin.coinbase + '\',\'' + vin.stakebase + '\',' + vin.sequence + ' ';
					db_inserts += 'FROM tx WHERE tx.hash = \'' + tx.txid + '\';';
				}
			}

			// Import any votes
			if (b_has_stakebase && tx.vout.length > 2)
			{
				// Second vout is the vote
				var voting_vout = tx.vout[1];

				if (voting_vout.hasOwnProperty('scriptPubKey') && voting_vout.scriptPubKey.hasOwnProperty('hex'))
				{
					// These rules are true NOW but they may change in future versions
					var vote_bits  = voting_vout.scriptPubKey.hex.substring(4,6);
					var issue_bits = voting_vout.scriptPubKey.hex.substring(6,10);

					db_inserts += 'INSERT INTO tx_vote ("tx_id", "hex", "votes", "version") ';
					db_inserts += 'SELECT tx.tx_id, \'' + voting_vout.scriptPubKey.hex + '\',\'' + vote_bits + '\',\'' + issue_bits + '\' ';
					db_inserts += 'FROM tx WHERE tx.hash = \'' + tx.txid + '\' ORDER BY tx.tx_id DESC LIMIT 1;\r\n';
				}
			}

			// Get the outgoing amounts & addresses
			for (var j = 0; j < tx.vout.length; j++) {
				var vout = tx.vout[j];

				// Set defaults if not provided
				if (!vout.hasOwnProperty('scriptPubKey')) { 
					vout.scriptPubKey = {type : '', reqSigs : 'NULL', commitamt : 'NULL'};
				}
				if (!vout.scriptPubKey.hasOwnProperty('reqSigs')) vout.scriptPubKey.reqSigs = 'NULL';
				if (!vout.scriptPubKey.hasOwnProperty('commitamt')) vout.scriptPubKey.commitamt = 'NULL';

				// Craft the vout key -- ("{blockheight}-{tree}-{blockindex}-{n}")
				var vout_key = block.height + '-' + tree_branch + '-' + i + '-' + vout.n;

				// Add the insert
				db_inserts += 'INSERT INTO vout ("tx_id","value","commitamt","n","version","type","reqSigs", "key") ';
				db_inserts += 'SELECT tx.tx_id,' + vout.value + ',' + vout.scriptPubKey.commitamt + ',' + vout.n + ',' + vout.version + ',\'' + vout.scriptPubKey.type + '\',' + vout.scriptPubKey.reqSigs + ',\'' + vout_key + '\' ';
				db_inserts += 'FROM tx WHERE tx.hash = \'' + tx.txid + '\' ORDER BY tx.tx_id DESC LIMIT 1;';

				if (tx.vout[j].scriptPubKey.hasOwnProperty('addresses')) {
					for (var k = 0; k < tx.vout[j].scriptPubKey.addresses.length; k++) {
						// Get the address
						var address = tx.vout[j].scriptPubKey.addresses[k];

						// Add the address insert
						db_inserts += 'INSERT INTO address("address") VALUES (\'' + address + '\') ON CONFLICT DO NOTHING;';

						// Add the connection to vout insert
						db_inserts += 'INSERT INTO vout_address ("vout_id", "address_id") ';
						db_inserts += 'SELECT vout.vout_id, address.address_id ';
						db_inserts += 'FROM vout JOIN address ON address.address = \'' + address + '\' ';
						db_inserts += 'WHERE vout.key = \'' + vout_key + '\';';
					}
				}
			}
		}
	}

	db_inserts += 'COMMIT;\r\n';

	// Write the insert file
	//var filesize = 5000;
	//var insert_location = './sql_data/blocks_' + Math.trunc(height/filesize)*filesize + '_' + (Math.trunc(height/filesize)*filesize+filesize-1) + '.sql';
	var insert_location = './sql_data/latest_blocks.sql';
	fs.appendFileSync(insert_location, db_inserts);

	return (height + 1);

}
