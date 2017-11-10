// Only using the legible block files
var fs = require('fs');

// Get all top addresses
var address_map = {};
var block_map = [];
var blockdir  = './blocks/';
var savefile  = 'address_map.current.json';
var odd_tree  = 0;

// Notes:
// blockheight = duh
// blockindex = how many TXes into the block
// vout = how many vouts into the TX <- that's all I need
// however, missing 1113689 transactions in the other tree
collectCurrentAddressValues();

function collectCurrentAddressValues() {
	var next_block_height = 1;
	while (next_block_height) {
		next_block_height = balanceTransactionsAtBlock(next_block_height);
		if (next_block_height%5000==0) {
			console.log("hrtbt@" + next_block_height);
			//saveProgress(next_block_height);
		}
	}

	console.log("Reached end.");
	block_map = null;
	delete block_map;
	saveProgress(next_block_height);
}

function saveProgress(height) {
	// Save our current state
	fs.writeFileSync(savefile, JSON.stringify(address_map));
}

function balanceTransactionsAtBlock(height) {
	// Collect the block
	var blocksubdir = "blocks_" + (Math.trunc(height/1000)*1000) + "_" + (Math.trunc(height/1000)*1000 + 999) + "/";
	var location = blockdir + blocksubdir + "block_" + height + ".json";

	// Validate that we have a file for this block
	if (!fs.existsSync(location)) {
		return null;
	}

	// Add next set of txes
	block_map.push([]);
	var block_map_idx = block_map.length - 1;

	// Collect all transactions
	var block_json = fs.readFileSync(location);
	var block = JSON.parse(block_json);
	block_json = null; delete block_json;
	var rawtxes = block["rawtx"];

	// For all transactions, keep tabs on who's paying and who's receiving
	for (var i = 0; i < rawtxes.length; i++) {
		// Get information about the transaction
		block_map[block_map_idx].push([]);
		var tx = rawtxes[i];

		// Get the incoming amounts
		for (var j = 0; j < tx.vin.length; j++) {
			// If this is not a coinbase, it has an origin vout
			if (tx.vin.length == 1 && tx.vin[j].hasOwnProperty('coinbase')) {
				continue;
			}

			// Find the origin vout and deduct from the address
			var blockheight = tx.vin[j].blockheight - 1;
			var blockindex  = tx.vin[j].blockindex;
			var voutindex   = tx.vin[j].vout;

			if (tx.vin[j].tree > 0) {
				odd_tree++;
				continue;
			}

			// Determine where this came from
			if (block_map.length > blockheight &&
				block_map[blockheight].length > blockindex &&
				block_map[blockheight][blockindex].length > voutindex)
			{
				var address = block_map[blockheight][blockindex][voutindex][0];
				var amount  = block_map[blockheight][blockindex][voutindex][1];

				//delete block_map[blockheight][blockindex][voutindex];

				if (address_map.hasOwnProperty(address)) {
					address_map[address] -= amount;
				} else {
					console.log("ERROR: Could not find address (" + address + ") " + blockheight + "->" + blockindex + "->" + voutindex);
					console.log("Currently on " + block_map_idx + "->" + i);
					process.exit();
				}
			}
			else
			{
				console.log("ERROR: Could not find " + blockheight + "->" + blockindex + "->" + voutindex);
				console.log("Currently on " + block_map_idx + "->" + i);
				process.exit();
			}
		}

		// Get the outgoing amounts & addresses
		for (var j = 0; j < tx.vout.length; j++) {
			// Add the set of txes
			block_map[block_map_idx][i].push([]);

			if (!tx.vout[j].scriptPubKey.hasOwnProperty('addresses')) {
				//block_map[block_map_idx][i][j] = ['OP_RETURN', tx.vout[j].value];
			}
			else {
				for (var k = 0; k < tx.vout[j].scriptPubKey.addresses.length; k++) {
					// Get the address
					var address = tx.vout[j].scriptPubKey.addresses[k];

					// Add this address and vout value to the map
					block_map[block_map_idx][i][j] = [address, tx.vout[j].value];

					// Add the address to the chain if it doesn't exist
					if (!address_map.hasOwnProperty(address)) {
						address_map[address] = 0;
					}

					// Add the value sent to the address
					address_map[address] += tx.vout[j].value;
				}
			}
		}
	}

	return (height + 1);
}
