var fs = require('fs');

// Get all top addresses
var address_whitelist = [], address_map = {};
var blockdir = './blocks/';
var top_list_file = 'top_500_list.json';
var savefile = 'top_500_account_details.json';

fs.exists(top_list_file, function(exists) {
	if (exists) {
		console.log("Pulling data.");
		fs.readFile(top_list_file, function(err, data) {
			if (err) {
				console.log("Could not read file.");
				process.exit();
			} else {
				// Pull the save state and restore
				var top_list = JSON.parse(data);

				// Set the addresses
				for (var item in top_list) {
					// Add the address to the whitelist
					address_whitelist.push(top_list[item][0]);
				}

				// Now get all the information we need
				collectAddressInfo();
			}
		});
	}
});

function collectAddressInfo() {
	var next_block_height = 1;
	while (next_block_height) {
		next_block_height = findAddressActivity(next_block_height);
		if (next_block_height%10000==0) {
			console.log("hrtbt@" + next_block_height);
		}
	}

	console.log("Reached end.");
	saveProgress();
}

function saveProgress() {
	// Save our current state
	fs.writeFileSync(savefile, JSON.stringify(address_map));
}

function findAddressActivity(height) {
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
					continue;
				}

				if (tx.vin[j].hasOwnProperty('stakebase')) {
					continue;
				}

				// See if the vout already exists
				var cached_origin_vout = tx.vin[j].origin_vout;

				// If we have a cached version, use it
				var address = cached_origin_vout["addresses"][0];
				var amount  = cached_origin_vout["amount"];

				// Only for the addresses we care about
				if (address_whitelist.indexOf(address) === -1) continue;

				if (address_map.hasOwnProperty(address)) {
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
				if (tx.vout[j].scriptPubKey.hasOwnProperty('addresses')) {
					for (var k = 0; k < tx.vout[j].scriptPubKey.addresses.length; k++) {
						// Get the address
						var address = tx.vout[j].scriptPubKey.addresses[k];

						// Only for the addresses we care about
						if (address_whitelist.indexOf(address) === -1) continue;

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
						}

						// Add the value sent to the address
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

	return (height + 1);
}