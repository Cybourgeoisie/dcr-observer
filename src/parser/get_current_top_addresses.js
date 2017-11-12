// Only using the legible block files
var fs = require('fs');

// Get all top addresses
var total_dcr = 0;
var address_map = {};
var blockdir  = './blocks/';
var savefile  = 'address_map.current.json';

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

	console.log("Reached end. Total DCR in circulation: " + total_dcr);
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
			// Get information about the transaction
			var tx = rawtxes[i];

			// Get the incoming amounts
			for (var j = 0; j < tx.vin.length; j++) {
				// If this is not a coinbase or a stakebase, it has an origin vout
				if (tx.vin.length == 1 && tx.vin[j].hasOwnProperty('coinbase')) {
					total_dcr += tx.vin[j].amountin;
					continue;
				}

				if (tx.vin[j].hasOwnProperty('stakebase')) {
					if (tx.vin[j].hasOwnProperty('tree') || tx.vin[j].hasOwnProperty('scriptSig')) {
						console.log("STAKEBASE FOUND, but potentially valid inputs");
						console.log("Requested block height: " + (blockheight+1) + ", tree: " + tree + ", TX: " + blockindex + ", Vout: " + voutindex);
						console.log("Current Block height: " + (height) + ", tree: " + tree_branch + ", TX: " + i + ", Vin: " + j);
					}
					total_dcr += tx.vin[j].amountin;
					continue;
				}

				// Find the origin vout and deduct from the address
				var blockheight = tx.vin[j].blockheight;
				var blockindex  = tx.vin[j].blockindex;
				var voutindex   = tx.vin[j].vout;

				// Choose the correct tree
				var tree = parseInt(tx.vin[j].tree);
				if (isNaN(tree)) {
					console.log("isNaN is true");
					console.log("Requested block height: " + blockheight + ", tree: " + tree + ", TX: " + blockindex + ", Vout: " + voutindex);
					console.log("Current Block height: " + height + ", tree: " + tree_branch + ", TX: " + i + ", Vin: " + j);
					console.log(tx.vin[j]);
					console.log(tx.vin[j].tree);
					process.exit();
				}

				// See if the vout already exists
				var cached_origin_vout = null;
				if (tx.vin[j].hasOwnProperty('origin_vout')) {
					// Found the match
					cached_origin_vout = tx.vin[j].origin_vout;
				}

				// If we have a cached version, use it
				var vout;
				if (cached_origin_vout) {
					vout = [cached_origin_vout["addresses"][0], cached_origin_vout["amount"]];
				// Otherwise, look it up
				} else {
					vout = getVout(blockheight, tree, blockindex, voutindex);

					var origin_vout = {
						'addresses' : vout[2],
						'amount'    : vout[1]
					};

					// Now save this shit
					if (tree_branch === 0) {
						block["rawtx"][i].vin[j].origin_vout = origin_vout;
					} else if (tree_branch === 1) {
						block["rawstx"][i].vin[j].origin_vout = origin_vout;
					}
				}

				var address = vout[0];
				var amount = vout[1];

				if (address_map.hasOwnProperty(address)) {
					address_map[address] -= amount;
				} else {
					console.log("ERROR: Could not find address (" + address + ") " + blockheight + "->" + blockindex + "->" + voutindex);
					console.log("Currently on " + height + "->" + i);
					process.exit();
				}
			}

			// Get the outgoing amounts & addresses
			for (var j = 0; j < tx.vout.length; j++) {
				if (!tx.vout[j].scriptPubKey.hasOwnProperty('addresses')) {
					//block_map[block_map_idx][i][j] = ['OP_RETURN', tx.vout[j].value];
				}
				else {
					for (var k = 0; k < tx.vout[j].scriptPubKey.addresses.length; k++) {
						// Get the address
						var address = tx.vout[j].scriptPubKey.addresses[k];

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

	// Now we finished with a block, save back to the chain
	//fs.writeFileSync(location, JSON.stringify(block));

	return (height + 1);
}

function getVout(height, tree, tx, vout) {
	// Collect the block
	var blocksubdir = "blocks_" + (Math.trunc(height/1000)*1000) + "_" + (Math.trunc(height/1000)*1000 + 999) + "/";
	var location = blockdir + blocksubdir + "block_" + height + ".json";

	// Validate that we have a file for this block
	if (!fs.existsSync(location)) {
		throw "getVout() can only find legitimate blocks. Location provided: " + location;
		process.exit();
	}

	// Open all transactions
	var block_json = fs.readFileSync(location);
	var block = JSON.parse(block_json);

	// Get the correct tree
	var txes;
	if (tree === 0) {
		txes = block['rawtx'];
	} else if (tree === 1) {
		txes = block['rawstx'];
	} else {
		throw "getVout() could not find the requested tree: " + tree;
		process.exit();
	}

	// Find the transaction we need
	// Determine where this came from
	var addresses, address, amount;
	if (txes.length > tx && 
		txes[tx].hasOwnProperty('vout') &&
		txes[tx]["vout"].length > vout)
	{
		addresses = txes[tx]["vout"][vout]["scriptPubKey"]["addresses"];
		address   = addresses[0].trim();
		amount    = txes[tx]["vout"][vout]["value"];

		if (address_map.hasOwnProperty(address)) {
			address_map[address] -= amount;
		} else {
			console.log("ERROR: Could not find address (" + address + ") " + height + "->" + tx + "->" + vout);
			process.exit();
		}
	}
	else
	{
		console.log("ERROR: Could not find " + height + "->" + tx + "->" + vout);
		process.exit();
	}

	return [address, amount, addresses];
}
