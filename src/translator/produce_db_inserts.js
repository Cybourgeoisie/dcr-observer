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
		if (height%2==0) {
			console.log("hrtbt@" + next_height);
			process.exit();
		}
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
	var db_inserts;

	// Insert the block
	db_inserts  = 'INSERT INTO block("hash", "height", "time", "version", "merkleroot", "stakeroot", ';
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
			db_inserts += 'WITH ins (block_height, txid_hash, tree, blockindex, version, locktime, expiry) AS ';
			db_inserts += '(VALUES (' + block.height + ',\'' + tx.txid + '\',' + tree_branch + ',';
			db_inserts += i + ',' + tx.version + ',' + tx.locktime + ',' + tx.expiry + ')) ';
			db_inserts += 'INSERT INTO tx ("block_id","hash","tree","blockindex","version","locktime","expiry") ';
			db_inserts += 'SELECT block.block_id, ins.txid_hash, ins.tree, ins.blockindex, ins.version, ins.locktime, ins.expiry ';
			db_inserts += 'FROM block JOIN ins ON ins.block_height = block.height; ';

			// Get the incoming amounts
			for (var j = 0; j < tx.vin.length; j++) {
				var vin = tx.vin[j];

				// Set defaults if not provided
				if (!vin.hasOwnProperty('coinbase')) vin.coinbase = '';
				if (!vin.hasOwnProperty('stakebase')) vin.stakebase = '';
				if (!vin.hasOwnProperty('tree')) vin.tree = 'NULL';
				if (!vin.hasOwnProperty('vout')) vin.vout = 'NULL';
				if (!vin.hasOwnProperty('scriptSig')) { vin.scriptSig = {asm : '', hex : ''}; }

				// Pull from a pre-existing vout if we can
				if (!vin.hasOwnProperty('coinbase') && !vin.hasOwnProperty('stakebase')) {
					// Craft the vout key -- ("{blockheight}-{tree}-{blockindex}-{n}")
					var vout_key = vin.blockheight + '-' + vin.tree + '-' + vin.blockindex + '-' + vin.vout;

					db_inserts += 'WITH ins (txid_hash, vout_key, amountin, blockheight, tree, blockindex, vout, coinbase, stakebase, sequence, asm, hex) ';
					db_inserts += 'AS (VALUES (\'' + tx.txid + '\', \'' + vout_key + '\'';
					db_inserts += vin.amountin + ',' + vin.blockheight + ',' + vin.tree + ',' + vin.blockindex + ',' + vin.vout + ',';
					db_inserts += '\'' + vin.coinbase + '\',\'' + vin.stakebase + '\',' + vin.sequence + ',';
					db_inserts += '\'' + vin.scriptSig.asm + '\',\'' + vin.scriptSig.hex + '\')) ';
					db_inserts += 'INSERT INTO vin ("tx_id", "vout_id", "amountin", "blockheight", "tree", "blockindex", "coinbase", "stakebase", "sequence", "asm", "hex") ';
					db_inserts += 'SELECT tx.tx_id, vout.vout_id, ins.amountin, ins.blockheight, ins.tree, ins.blockindex, ins.coinbase, ins.stakebase, ins.sequence, ins.asm, ins.hex ';
					db_inserts += 'FROM ins JOIN tx ON ins.txid_hash = tx.hash';
					db_inserts += 'JOIN vout ON ins.vout_key = vout.key;';
				} else {
					db_inserts += 'WITH ins (txid_hash, amountin, blockheight, tree, blockindex, vout, coinbase, stakebase, sequence, asm, hex) ';
					db_inserts += 'AS (VALUES (\'' + tx.txid + '\',';
					db_inserts += vin.amountin + ',' + vin.blockheight + ',' + vin.tree + ',' + vin.blockindex + ',' + vin.vout + ',';
					db_inserts += '\'' + vin.coinbase + '\',\'' + vin.stakebase + '\',' + vin.sequence + ',';
					db_inserts += '\'' + vin.scriptSig.asm + '\',\'' + vin.scriptSig.hex + '\')) ';
					db_inserts += 'INSERT INTO vin ("tx_id", "amountin", "blockheight", "tree", "blockindex", "coinbase", "stakebase", "sequence", "asm", "hex") ';
					db_inserts += 'SELECT tx.tx_id, vout.vout_id, ins.amountin, ins.blockheight, ins.tree, ins.blockindex, ins.coinbase, ins.stakebase, ins.sequence, ins.asm, ins.hex ';
					db_inserts += 'FROM ins JOIN tx ON ins.txid_hash = tx.hash;';
				}
			}

			// Get the outgoing amounts & addresses
			for (var j = 0; j < tx.vout.length; j++) {
				var vout = tx.vout[j];

				// Set defaults if not provided
				if (!vout.hasOwnProperty('commitamt')) vout.commitamt = 'NULL';
				if (!vin.hasOwnProperty('scriptPubKey')) { 
					vin.scriptPubKey = {asm : '', hex : '', type : '', reqSigs : 'NULL'};
				}

				// Craft the vout key -- ("{blockheight}-{tree}-{blockindex}-{n}")
				var vout_key = block.height + '-' + tree_branch + '-' + i + '-' + vout.n;

				// Add the insert
				db_inserts += 'WITH ins (txid_hash, value, commitamt, n, version, type, asm, hex, reqSigs, key) AS ';
				db_inserts += '(VALUES (\'' + tx.txid + '\',' + vout.value + ',' + vout.commitamt + ',';
				db_inserts += vout.n + ',' + vout.version + ',\'' + vout.scriptPubKey.type + '\',\'' + vout.scriptPubKey.asm + '\',';
				db_inserts += '\'' + vout.scriptPubKey.hex + '\',' + vout.scriptPubKey.reqSigs + ',\'' + vout_key + '\')) ';
				db_inserts += 'INSERT INTO vout ("tx_id","value","commitamt","n","version","type","asm","hex","reqSigs", "key") ';
				db_inserts += 'SELECT tx.tx_id, ins.value, ins.commitamt, ins.n, ins.version, ins.type, ins.asm, ins.hex, ins.reqSigs, ins.key ';
				db_inserts += 'FROM tx JOIN ins ON ins.txid_hash = tx.hash; ';

				if (tx.vout[j].scriptPubKey.hasOwnProperty('addresses')) {
					for (var k = 0; k < tx.vout[j].scriptPubKey.addresses.length; k++) {
						// Get the address
						var address = tx.vout[j].scriptPubKey.addresses[k];

						// Add the address insert
						db_inserts += 'INSERT INTO address("address") VALUES (\'' + address + '\') ON CONFLICT DO NOTHING;';

						// Add the connection to vout insert
						db_inserts += 'WITH ins (vout_key, address) AS ';
						db_inserts += '(VALUES (\'' + vout_key + '\', \'' + address + '\')) ';
						db_inserts += 'INSERT INTO vout_address ("vout_id", "address_id") ';
						db_inserts += 'SELECT vout.vout_id, address.address_id FROM ins ';
						db_inserts += 'JOIN vout ON ins.vout_key = vout.key ';
						db_inserts += 'JOIN address ON ins.address = address.address; ';
					}
				}
			}
		}
	}

	// Write the insert file
	var insert_location = './blocks_' + height + '_' + height + '.sql';
	fs.writeFileSync(insert_location, db_inserts);

	return (height + 1);

}
