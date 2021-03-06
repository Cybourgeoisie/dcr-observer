// Only using the legible block files
var fs = require('fs');

// Get all top addresses
var total_dcr = 0;
var address_map = {};
var blockdir  = '../../../blocks/';
var savefile  = '../../../address_map.full.json';

// If we have a save state, use it
fs.exists(savefile, function(exists) {
	if (!exists) {
		collectCurrentAddressValues();
	} else {
		console.log("Using save state.");
		fs.readFile(savefile, function(err, data) {
			if (err) {
				console.log("Could not read save state file.");
				process.exit();
			} else {
				// Pull the save state and restore
				address_map = JSON.parse(data);

				// Pull the height
				var next_height = 1;
				if (address_map.hasOwnProperty('next_height')) {
					next_height = address_map.next_height;
				}

				// Report save information
				console.log("Starting at height " + next_height + ".");

				// Now collect current address values
				collectCurrentAddressValues(next_height);
			}
		});
	}
});

function collectCurrentAddressValues(next_block_height) {
	if (!next_block_height) {
		next_block_height = 1;
	}

	var current_block_height = next_block_height;
	while (next_block_height) {
		current_block_height = next_block_height;
		next_block_height = balanceTransactionsAtBlock(next_block_height);
		if (next_block_height%10000==0) {
			console.log("hrtbt@" + next_block_height);
			//saveProgress(next_block_height);
			//process.exit();
		}
	}

	console.log("Reached end. Total DCR in circulation: " + total_dcr);
	saveProgress(current_block_height+1);
}

function saveProgress(next_height) {
	// Store the height to the map
	// We save directly to the map for two reasons:
	// (1) Guarantee of no collision
	// (2) address_map is too large to copy into another object
	address_map.next_height = next_height;

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

	// Keep track of whether we need to update this block's file
	var b_update_block_file = false;

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

					// Need to update the block file
					b_update_block_file = true
					console.log("Updating block file #" + blockheight + " from block #" + height);
				}

				var address = vout[0];
				var amount = vout[1];

				if (address_map.hasOwnProperty(address)) {
					//address_map[address] -= amount;
					address_map[address].val  -= amount;
					address_map[address].out  += amount;
					address_map[address].sout += (tree_branch === 1) ? amount : 0;
					address_map[address].tx   += 1;
					address_map[address].stx  += (tree_branch === 1) ? 1 : 0;
					address_map[address].last  = height;
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
							address_map[address] = {
								'val'   : 0,
								'in'    : 0,
								'out'   : 0,
								'sin'   : 0,
								'sout'  : 0,
								'tx'    : 0,
								'stx'   : 0,
								'first' : height,
								'last'  : height
							};
							//address_map[address] = 0;
						}

						// Add the value sent to the address
						//address_map[address] += tx.vout[j].value;
						address_map[address].val  += tx.vout[j].value;
						address_map[address].in   += tx.vout[j].value;
						address_map[address].sin  += (tree_branch === 1) ? tx.vout[j].value : 0;
						address_map[address].tx   += 1;
						address_map[address].stx  += (tree_branch === 1) ? 1 : 0;
						address_map[address].last  = height;
					}
				}
			}
		}
	}

	// Now we finished with a block, save back to the chain
	if (b_update_block_file) {
		fs.writeFileSync(location, JSON.stringify(block));		
	}

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
	}
	else
	{
		console.log("ERROR: Could not find " + height + "->" + tx + "->" + vout);
		process.exit();
	}

	return [address, amount, addresses];
}

// Notes:
// blockheight = duh
// tree = whether it's a stake ticket or tx
// blockindex = how many TXes into the block
// vout = how many vouts into the TX <- that's all I need
// HOWEVER - tickets are separate addresses. We need to link them to parent addresses.