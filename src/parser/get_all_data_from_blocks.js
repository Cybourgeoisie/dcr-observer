// Only using the legible block files
var fs = require('fs');

// Get all top addresses
var total_dcr = 0;
var address_count = 0, network_count = 0;
var address_map = {}, network_map = {}, identifiers = {};
//var blockdir = './blocks/';
//var savefile  = 'address_map.all.json';
var blockdir  = '../../../blocks/';
var savefile  = '../../../address_map.all.json';
var identifier_file = './data/identifiers.json';
//var network_savefile  = '../../../address_network.json';

var b_create_historical_snapshots = false;
var b_testing_only = false;

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

				// Pull the last height that we visited, total_dcr, account counts
				var last_height = 0;
				if (address_map.hasOwnProperty('last_height')) {
					last_height = address_map.last_height;
				}

				if (address_map.hasOwnProperty('total_dcr')) {
					total_dcr = address_map.total_dcr;
				}

				if (address_map.hasOwnProperty('address_count')) {
					address_count = address_map.address_count;
				}

				// Report save information
				console.log("Starting at height " + (last_height+1) + ".");

				// Now collect current address values
				collectCurrentAddressValues(last_height+1);
			}
		});
	}
});

function collectCurrentAddressValues(next_block_height) {
	// First get the identifiers for various addresses
	if (!fs.existsSync(identifier_file)) {
		return null;
	}

	// Collect all transactions
	var identifiers_json = fs.readFileSync(identifier_file);
	identifiers = JSON.parse(identifiers_json);

	if (!next_block_height) {
		next_block_height = 1;
	}

	var current_block_height = next_block_height;
	while (next_block_height) {
		current_block_height = next_block_height;

		if (next_block_height%10000==0) {
			console.log("hrtbt@" + next_block_height + " & " + current_block_height);
			if (b_create_historical_snapshots) {
				calculateRichListAndWealthDistribution(next_block_height);
				collectNetworks();
				calculateNetworkRichListAndWealthDistribution(next_block_height);
			}

			//saveProgress(next_block_height);
			//process.exit();
		}

		next_block_height = balanceTransactionsAtBlock(next_block_height);

		if (b_testing_only) {
			if (current_block_height%1000==0 || current_block_height%6199==0) {
				console.log("Testing save files for valid states.")
				break;
			}
		}
	}

	console.log("Reached end at block " + current_block_height + ". Total DCR in circulation: " + total_dcr);

	// First, calculate the rich list and wealth distribution at this snapshot
	calculateRichListAndWealthDistribution();
	collectNetworks();
	calculateNetworkRichListAndWealthDistribution();
	//saveNetworks();

	// Save the current address state
	saveProgress(current_block_height);
}

function saveProgress(last_height) {
	// Store the incremented variables to the savefile
	// We save directly to the map for two reasons:
	// (1) Guarantee of no collision
	// (2) address_map is too large to copy into another object
	address_map.last_height   = last_height;
	address_map.total_dcr     = total_dcr;
	address_map.address_count = address_count;

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

			// Make sure we only add new txes once
			var this_tx_address_updates = [];

			// Get the incoming amounts
			var connected_addresses = [];
			for (var j = 0; j < tx.vin.length; j++) {
				// If this is not a coinbase or a stakebase, it has an origin vout
				if (tx.vin.length == 1 && tx.vin[j].hasOwnProperty('coinbase')) {
					total_dcr += tx.vin[j].amountin;
					continue;
				}

				if (tx.vin[j].hasOwnProperty('stakebase')) {
					total_dcr += tx.vin[j].amountin;
					continue;
				}

				// Find the origin vout and deduct from the address
				var blockheight = tx.vin[j].blockheight;
				var tree        = tx.vin[j].tree;
				var blockindex  = tx.vin[j].blockindex;
				var voutindex   = tx.vin[j].vout;

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
				//var amount = vout[1];

				if (address_map.hasOwnProperty(address)) {
					// Keep track of HD wallet connections
					connected_addresses.push(address);
					address_map[address].val  -= tx.vin[j].amountin;
					address_map[address].out  += tx.vin[j].amountin;
					address_map[address].sout += (tree_branch === 1) ? tx.vin[j].amountin : 0;
					address_map[address].last  = height;
					address_map[address].end   = block.time;

					// See if we already updated the address for this TX
					if (this_tx_address_updates.indexOf(address) === -1) {
						address_map[address].tx   += 1;
						address_map[address].stx  += (tree_branch === 1) ? 1 : 0;
						this_tx_address_updates.push(address);
					}
				} else {
					console.log("ERROR: Could not find address (" + address + ") " + blockheight + "->" + blockindex + "->" + voutindex);
					console.log("Currently on " + height + "->" + i);
					process.exit();
				}
			}

			// For all incoming addresses, connect them by the minimum network
			var first_network;
			if (connected_addresses.length > 0) {
				first_network = address_map[connected_addresses[0]].nw;

				// Pick the lowest network ID
				for (var ca_idx = 1; ca_idx < connected_addresses.length; ca_idx++) {
					if (first_network > address_map[connected_addresses[ca_idx]].nw) {
						first_network = address_map[connected_addresses[ca_idx]].nw;
					}
				}

				// Now set them all to the primary network
				for (var ca_idx = 0; ca_idx < connected_addresses.length; ca_idx++) {
					address_map[connected_addresses[ca_idx]].nw = first_network;
				}
			}

			// Get the outgoing amounts & addresses
			for (var j = 0; j < tx.vout.length; j++) {
				if (tx.vout[j].scriptPubKey.hasOwnProperty('addresses')) {
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
								'start' : block.time,
								'last'  : height,
								'end'   : block.time,
								'nw'    : ++address_count // Network
							};

							// If this address has a known identifier, attach it
							if (identifiers.hasOwnProperty(address)) {
								address_map[address].identifier = identifiers[address];
							}
						}

						// Add the value sent to the address
						address_map[address].val  += tx.vout[j].value;
						address_map[address].in   += tx.vout[j].value;
						address_map[address].sin  += (tree_branch === 1) ? tx.vout[j].value : 0;
						address_map[address].last  = height;
						address_map[address].end   = block.time;

						// See if we already updated the address for this TX
						if (this_tx_address_updates.indexOf(address) === -1) {
							address_map[address].tx   += 1;
							address_map[address].stx  += (tree_branch === 1) ? 1 : 0;
							this_tx_address_updates.push(address);
						}
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
	if (tree == 0) {
		txes = block['rawtx'];
	} else if (tree == 1) {
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

function calculateRichListAndWealthDistribution(height) {
	// Notify
	console.log("Building rich list and wealth distribution...");

	if (height) {
		console.log("For historical data at height " + height);
	}

	// Set the addresses
	var addresses = [];
	for (var address in address_map) {
		// Ignore all 0 and dust wallets
		if (address_map[address].val <= 0.00000001) { continue; }
		addresses.push([address, address_map[address].val]);
		if (address_map[address].hasOwnProperty('identifier')) {
			addresses[addresses.length-1].push(address_map[address].identifier);
		}
	}

	// Notification
	console.log("There are " + addresses.length + " addresses in total.");

	// Order the list
	console.log("Ordering rich list...");
	addresses.sort(function(a, b) {return b[1] - a[1];});

	// Now save the richest 500
	var top_500 = addresses.slice(0,500);
	var top_500_data = {
		'top' : top_500,
		'total_dcr' : total_dcr
	};

	var filename = 'top_500_list.json';
	if (height) { filename = 'top_500_list.' + height + '.json'; }
	fs.writeFileSync(filename, JSON.stringify(top_500_data));

	// Now get their full info
	var top_500_info = {};
	for (var i = 0; i < top_500.length; i++) {
		top_500_info[top_500[i][0]] = address_map[top_500[i][0]];
	}

	// And write that
	var filename = 'top_500_info_list.json';
	if (height) { filename = 'top_500_info_list.' + height + '.json'; }
	fs.writeFileSync(filename, JSON.stringify({
		'top' : top_500_info,
		'total_dcr' : total_dcr
	}));

	// And determine the wealth distribution
	var bins   = [1, 10, 100, 1000, 10000, 100000, 1000000];
	var counts = [0,  0,   0,    0,     0,      0,       0];
	var value  = [0,  0,   0,    0,     0,      0,       0];
	for (var i = 0; i < addresses.length; i++) {
		for (var j = 0; j < bins.length; j++) {
			if (addresses[i][1] <= bins[j]) {
				value[j] += addresses[i][1];
				counts[j]++;
				break;
			}
		}
	}

	var filename = 'wealth_distribution.json';
	if (height) { filename = 'wealth_distribution.' + height + '.json'; }
	fs.writeFileSync(filename, JSON.stringify({
		'bins' : bins,
		'counts' : counts,
		'value' : value,
		'total_dcr' : total_dcr
	}));

	console.log("Bins: " + bins);
	console.log("Counts: " + counts);
	console.log("Value: " + value);
}

function collectNetworks() {
	network_map = {};
	network_count = 0;
	for (var address in address_map) {
		var network_id = address_map[address].nw;
		if (!network_map.hasOwnProperty(network_id)) {
			network_count++;
			network_map[network_id] = {
				'addr_count' : 0,
				'val' : 0.0,
				'lgst_val' : 0.0,
				'lgst_addr' : 'NULL'
			};
		}
		network_map[network_id].addr_count++;
		network_map[network_id].val += (address_map[address].val > 0) ? address_map[address].val : 0;
		if (parseFloat(address_map[address].val) > parseFloat(network_map[network_id].lgst_val)) {
			network_map[network_id].lgst_val  = address_map[address].val;
			network_map[network_id].lgst_addr = address;
		}
	}
}

function saveNetworks() {
	// Reduce the address map to networks
	// We use the same array to save space
	for (var address in address_map) {
		address_map[address] = address_map[address].nw;
	}

	// Save the file
	fs.writeFileSync(network_savefile, JSON.stringify(address_map));
}

function calculateNetworkRichListAndWealthDistribution(height) {
	// Notify
	console.log("Building network rich list and wealth distribution...");
	console.log("Total network count: " + network_count);

	var networks = [];
	for (var network_id in network_map) {
		// Ignore all 0 and dust wallets
		if (network_map[network_id].val > 0.00000001) {
			networks.push([network_id, network_map[network_id].val, network_map[network_id].addr_count, network_map[network_id].lgst_addr]);

			if (address_map[network_map[network_id].lgst_addr].hasOwnProperty('identifier')) {
				networks[networks.length-1].push(address_map[network_map[network_id].lgst_addr].identifier);
			}
		}
	}

	// Order the list
	console.log("Ordering rich list...");
	networks.sort(function(a, b) {return b[1] - a[1];});

	// Now save the richest 500
	var top_500 = networks.slice(0,500);
	var top_500_data = {
		'top' : top_500,
		'total_dcr' : total_dcr
	};

	var filename = 'top_500_networks_list.json';
	if (height) { filename = 'top_500_networks_list.' + height + '.json'; }
	fs.writeFileSync(filename, JSON.stringify(top_500_data));

	// And determine the wealth distribution
	var bins   = [1, 10, 100, 1000, 10000, 100000, 1000000];
	var counts = [0,  0,   0,    0,     0,      0,       0];
	var value  = [0,  0,   0,    0,     0,      0,       0];
	for (var i = 0; i < networks.length; i++) {
		for (var j = 0; j < bins.length; j++) {
			if (networks[i][1] <= bins[j]) {
				value[j] += networks[i][1];
				counts[j]++;
				break;
			}
		}
	}

	var filename = 'wealth_distribution_networks.json';
	if (height) { filename = 'wealth_distribution_networks.' + height + '.json'; }
	fs.writeFileSync(filename, JSON.stringify({
		'bins' : bins,
		'counts' : counts,
		'value' : value,
		'total_dcr' : total_dcr
	}));

	console.log("Bins: " + bins);
	console.log("Counts: " + counts);
	console.log("Value: " + value);
}
