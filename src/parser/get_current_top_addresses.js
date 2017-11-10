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
// Just added the logic to handle transactions from both trees
// HOWEVER - tickets are separate addresses. We need to link them to parent addresses.
collectCurrentAddressValues();

function collectCurrentAddressValues() {
	var next_block_height = 1;
	while (next_block_height) {
		next_block_height = balanceTransactionsAtBlock(next_block_height);
		if (next_block_height%5000==0) {
			console.log("hrtbt@" + next_block_height);
		}
	}

	console.log("Reached end.");
	block_map = null; delete block_map;
	saveProgress();
}

function saveProgress() {
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

	// Create room for two types of transactions - normal (tree = 0) and stake (tree = 1)
	block_map[block_map_idx].push([],[]);

	// Collect all transactions
	var block_json = fs.readFileSync(location);
	var block = JSON.parse(block_json);

	// Mark some memory up for GC
	block_json = null; delete block_json;

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
			// Add room for the next transaction on this tree
			block_map[block_map_idx][tree_branch].push([]);

			// Get information about the transaction
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

				// Choose the correct tree
				var tree = parseInt(tx.vin[j].tree);

				// Determine where this came from
				if (block_map.length > blockheight &&
					block_map[blockheight][tree].length > blockindex &&
					block_map[blockheight][tree][blockindex].length > voutindex)
				{
					var address = block_map[blockheight][tree][blockindex][voutindex][0];
					var amount  = block_map[blockheight][tree][blockindex][voutindex][1];

					// Apparently.. this broke something at a later transaction. Double-spend attempt?
					// Definitely want to investigate the cause of this further
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
				// Add the next vout from this transaction
				block_map[block_map_idx][tree_branch][i].push([]);

				if (!tx.vout[j].scriptPubKey.hasOwnProperty('addresses')) {
					//block_map[block_map_idx][i][j] = ['OP_RETURN', tx.vout[j].value];
				}
				else {
					for (var k = 0; k < tx.vout[j].scriptPubKey.addresses.length; k++) {
						// Get the address
						var address = tx.vout[j].scriptPubKey.addresses[k];

						// Add this address and vout value to the map
						block_map[block_map_idx][tree_branch][i][j] = [address, tx.vout[j].value];

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
	}

	return (height + 1);
}
